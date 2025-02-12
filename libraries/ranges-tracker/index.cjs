/**
 * The purpose of this class is to track a set of inserts and deletes to a document, like
 * track changes in Word. We store these as a set of ShareJs style ranges:
 *   {i: "foo", p: 42} # Insert 'foo' at offset 42
 *   {d: "bar", p: 37} # Delete 'bar' at offset 37
 * We only track the inserts and deletes, not the whole document, but by being given all
 * updates that are applied to a document, we can update these appropriately.
 *
 * Note that the set of inserts and deletes we store applies to the document as-is at the moment.
 * So inserts correspond to text which is in the document, while deletes correspond to text which
 * is no longer there, so their lengths do not affect the position of later offsets.
 * E.g.
 *             this is the current text of the document
 *                         |-----|            |
 *  {i: "current ", p:12} -^                   ^- {d: "old ", p: 31}
 *
 * Track changes rules (should be consistent with Word):
 *   * When text is inserted at a delete, the text goes to the left of the delete
 *       I.e. "foo|bar" -> "foobaz|bar", where | is the delete, and 'baz' is inserted
 *   * Deleting content flagged as 'inserted' does not create a new delete marker, it only
 *     removes the insert marker. E.g.
 *       * "abdefghijkl"        -> "abfghijkl"        when 'de' is deleted. No delete marker added
 *           |---| <- inserted       |-| <- inserted
 *       * Deletes overlapping regular text and inserted text will insert a delete marker for the
 *         regular text:
 *         "abcdefghijkl"    ->    "abcdejkl"   when 'fghi' is deleted
 *           |----|                  |--||
 *           ^- inserted 'bcdefg'      \ ^- deleted 'hi'
 *                                      \--inserted 'bcde'
 *   * Deletes overlapping other deletes are merged. E.g.
 *      "abcghijkl"        ->   "ahijkl"     when 'bcg is deleted'
 *          | <- delete 'def'     | <- delete 'bcdefg'
 *   * Deletes by another user will consume deletes by the first user
 *   * Inserts by another user will not combine with inserts by the first user. If they are in the
 *     middle of a previous insert by the first user, the original insert will be split into two.
 */
class RangesTracker {
  constructor(changes, comments) {
    if (changes == null) {
      changes = []
    }
    this.changes = changes
    if (comments == null) {
      comments = []
    }
    this.comments = comments
    this.track_changes = false
    this.id_seed = RangesTracker.generateIdSeed()
    this.id_increment = 0
    this._dirtyState = {
      comment: {
        moved: {},
        removed: {},
        added: {},
      },
      change: {
        moved: {},
        removed: {},
        added: {},
      },
    }
  }

  getIdSeed() {
    return this.id_seed
  }

  setIdSeed(seed) {
    this.id_seed = seed
    this.id_increment = 0
  }

  static generateIdSeed() {
    // Generate a the first 18 characters of Mongo ObjectId, leaving 6 for the increment part
    // Reference: https://github.com/dreampulse/ObjectId.js/blob/master/src/main/javascript/Objectid.js
    const pid = Math.floor(Math.random() * 32767).toString(16)
    const machine = Math.floor(Math.random() * 16777216).toString(16)
    const timestamp = Math.floor(new Date().valueOf() / 1000).toString(16)
    return (
      '00000000'.substr(0, 8 - timestamp.length) +
      timestamp +
      '000000'.substr(0, 6 - machine.length) +
      machine +
      '0000'.substr(0, 4 - pid.length) +
      pid
    )
  }

  static generateId() {
    return this.generateIdSeed() + '000001'
  }

  newId() {
    this.id_increment++
    const increment = this.id_increment.toString(16)
    const id =
      this.id_seed + '000000'.substr(0, 6 - increment.length) + increment
    return id
  }

  getComment(commentId) {
    let comment = null
    for (const c of this.comments) {
      if (c.id === commentId) {
        comment = c
        break
      }
    }
    return comment
  }

  removeCommentId(commentId) {
    const comment = this.getComment(commentId)
    if (comment == null) {
      return
    }
    this.comments = this.comments.filter(c => c.id !== commentId)
    this._markAsDirty(comment, 'comment', 'removed')
  }

  moveCommentId(commentId, position, text) {
    for (const comment of this.comments) {
      if (comment.id === commentId) {
        comment.op.p = position
        comment.op.c = text
        this._markAsDirty(comment, 'comment', 'moved')
      }
    }
  }

  getChange(changeId) {
    let change = null
    for (const c of this.changes) {
      if (c.id === changeId) {
        change = c
        break
      }
    }
    return change
  }

  getChanges(ids) {
    const idSet = new Set(ids)
    return this.changes.filter(change => idSet.has(change.id))
  }

  removeChangeId(changeId) {
    this.removeChangeIds([changeId])
  }

  removeChangeIds(ids) {
    if (ids == null || ids.length === 0) {
      return
    }

    const idSet = new Set(ids)
    const remainingChanges = []
    for (const change of this.changes) {
      if (idSet.has(change.id)) {
        this._markAsDirty(change, 'change', 'removed')
      } else {
        remainingChanges.push(change)
      }
    }

    this.changes = remainingChanges
  }

  validate(text) {
    let content
    for (const change of this.changes) {
      if (change.op.i != null) {
        content = text.slice(change.op.p, change.op.p + change.op.i.length)
        if (content !== change.op.i) {
          throw new Error('insertion does not match text in document')
        }
      }
    }
    for (const comment of this.comments) {
      content = text.slice(comment.op.p, comment.op.p + comment.op.c.length)
      if (content !== comment.op.c) {
        throw new Error('comment does not match text in document')
      }
    }
  }

  applyOp(op, metadata) {
    if (metadata == null) {
      metadata = {}
    }
    if (metadata.ts == null) {
      metadata.ts = new Date()
    }
    // Apply an op that has been applied to the document to our changes to keep them up to date
    if (op.i != null) {
      this.applyInsertToChanges(op, metadata)
      this.applyInsertToComments(op)
    } else if (op.d != null) {
      this.applyDeleteToChanges(op, metadata)
      this.applyDeleteToComments(op)
    } else if (op.c != null) {
      this.addComment(op, metadata)
    } else {
      throw new Error('unknown op type')
    }
  }

  applyOps(ops, metadata) {
    if (metadata == null) {
      metadata = {}
    }
    for (const op of ops) {
      this.applyOp(op, metadata)
    }
  }

  addComment(op, metadata) {
    const existing = this.getComment(op.t)
    if (existing != null) {
      this.moveCommentId(op.t, op.p, op.c)
    } else {
      let comment
      this.comments.push(
        (comment = {
          id: op.t || this.newId(),
          op: {
            // Copy because we'll modify in place
            c: op.c,
            p: op.p,
            t: op.t,
          },
          metadata,
        })
      )
      this._markAsDirty(comment, 'comment', 'added')
    }
  }

  applyInsertToComments(op) {
    for (const comment of this.comments) {
      if (op.p <= comment.op.p) {
        comment.op.p += op.i.length
        this._markAsDirty(comment, 'comment', 'moved')
      } else if (op.p < comment.op.p + comment.op.c.length) {
        const offset = op.p - comment.op.p
        comment.op.c =
          comment.op.c.slice(0, +(offset - 1) + 1 || undefined) +
          op.i +
          comment.op.c.slice(offset)
        this._markAsDirty(comment, 'comment', 'moved')
      }
    }
  }

  applyDeleteToComments(op) {
    const opStart = op.p
    const opLength = op.d.length
    const opEnd = op.p + opLength
    for (const comment of this.comments) {
      const commentStart = comment.op.p
      const commentEnd = comment.op.p + comment.op.c.length
      const commentLength = commentEnd - commentStart
      if (opEnd <= commentStart) {
        // delete is fully before comment
        comment.op.p -= opLength
        this._markAsDirty(comment, 'comment', 'moved')
      } else if (opStart >= commentEnd) {
        // delete is fully after comment, nothing to do
      } else {
        // delete and comment overlap
        let remainingAfter, remainingBefore
        if (opStart <= commentStart) {
          remainingBefore = ''
        } else {
          remainingBefore = comment.op.c.slice(0, opStart - commentStart)
        }
        if (opEnd >= commentEnd) {
          remainingAfter = ''
        } else {
          remainingAfter = comment.op.c.slice(opEnd - commentStart)
        }

        // Check deleted content matches delete op
        const deletedComment = comment.op.c.slice(
          remainingBefore.length,
          commentLength - remainingAfter.length
        )
        const offset = Math.max(0, commentStart - opStart)
        const deletedOpContent = op.d
          .slice(offset)
          .slice(0, deletedComment.length)
        if (deletedComment !== deletedOpContent) {
          throw new Error('deleted content does not match comment content')
        }

        comment.op.p = Math.min(commentStart, opStart)
        comment.op.c = remainingBefore + remainingAfter
        this._markAsDirty(comment, 'comment', 'moved')
      }
    }
  }

  applyInsertToChanges(op, metadata) {
    let change
    const opStart = op.p
    const opLength = op.i.length
    const opEnd = op.p + opLength
    const undoing = !!op.u
    const fixedRemoveChange = op.fixedRemoveChange

    let alreadyMerged = false
    let previousChange = null
    const movedChanges = []
    const removeChanges = []
    const newChanges = []
    const trackedDeletesAtOpPosition = []
    for (let i = 0; i < this.changes.length; i++) {
      change = this.changes[i]
      const changeStart = change.op.p

      if (change.op.d != null) {
        // Shift any deletes after this along by the length of this insert
        if (opStart < changeStart) {
          change.op.p += opLength
          movedChanges.push(change)
        } else if (opStart === changeStart) {
          if (
            !alreadyMerged &&
            undoing &&
            change.op.d.length >= op.i.length &&
            change.op.d.slice(0, op.i.length) === op.i
          ) {
            // If we are undoing, then we want to reject any existing tracked delete if we can.
            // Check if the insert matches the start of the delete, and just
            // remove it from the delete instead if so.
            change.op.d = change.op.d.slice(op.i.length)
            change.op.p += op.i.length
            if (change.op.d === '') {
              removeChanges.push(change)
            } else {
              movedChanges.push(change)
            }
            alreadyMerged = true

            // Any tracked delete that came before this tracked delete
            // rejection was moved after the incoming insert. Move them back
            // so that they appear before the tracked delete rejection.
            for (const trackedDelete of trackedDeletesAtOpPosition) {
              trackedDelete.op.p -= opLength
            }
          } else {
            // We're not rejecting that tracked delete. Move it after the
            // insert.
            change.op.p += opLength
            movedChanges.push(change)

            // Keep track of tracked deletes that are at the same position as the
            // insert. If we find a tracked delete to reject, we'll want to
            // reposition them.
            if (!alreadyMerged) {
              trackedDeletesAtOpPosition.push(change)
            }
          }
        }
      } else if (change.op.i != null) {
        let offset
        const changeEnd = changeStart + change.op.i.length
        const isChangeOverlapping =
          opStart >= changeStart && opStart <= changeEnd

        // Only merge inserts if they are from the same user
        const isSameUser = metadata.user_id === change.metadata.user_id

        // If we are undoing, then our changes will be removed from any delete ops just after. In that case, if there is also
        // an insert op just before, then we shouldn't append it to this insert, but instead only cancel the following delete.
        // E.g.
        //                   foo|<--- about to insert 'b' here
        //  inserted 'foo'  --^ ^-- deleted 'bar'
        // should become just 'foo' not 'foob' (with the delete marker becoming just 'ar'), .
        const nextChange = this.changes[i + 1]
        const isOpAdjacentToNextDelete =
          nextChange != null &&
          nextChange.op.d != null &&
          op.p === changeEnd &&
          nextChange.op.p === op.p
        const willOpCancelNextDelete =
          undoing &&
          isOpAdjacentToNextDelete &&
          nextChange.op.d.slice(0, op.i.length) === op.i

        // If there is a delete at the start of the insert, and we're inserting
        // at the start, we SHOULDN'T merge since the delete acts as a partition.
        // The previous op will be the delete, but it's already been shifted by this insert
        //
        // I.e.
        // Originally: |-- existing insert --|
        //             | <- existing delete at same offset
        //
        // Now:        |-- existing insert --| <- not shifted yet
        //             |-- this insert --|| <- existing delete shifted along to end of this op
        //
        // After:                         |-- existing insert --|
        //             |-- this insert --|| <- existing delete
        //
        // Without the delete, the inserts would be merged.
        const isInsertBlockedByDelete =
          previousChange != null &&
          previousChange.op.d != null &&
          previousChange.op.p === opEnd

        // If the insert is overlapping another insert, either at the beginning in the middle or touching the end,
        // then we merge them into one.
        if (
          this.track_changes &&
          isChangeOverlapping &&
          !isInsertBlockedByDelete &&
          !alreadyMerged &&
          !willOpCancelNextDelete &&
          isSameUser
        ) {
          offset = opStart - changeStart
          change.op.i =
            change.op.i.slice(0, offset) + op.i + change.op.i.slice(offset)
          change.metadata.ts = metadata.ts
          alreadyMerged = true
          movedChanges.push(change)
        } else if (opStart <= changeStart) {
          // If we're fully before the other insert we can just shift the other insert by our length.
          // If they are touching, and should have been merged, they will have been above.
          // If not merged above, then it must be blocked by a delete, and will be after this insert, so we shift it along as well
          change.op.p += opLength
          movedChanges.push(change)
        } else if (
          (!isSameUser || !this.track_changes) &&
          changeStart < opStart &&
          opStart < changeEnd
        ) {
          // This user is inserting inside a change by another user, so we need to split the
          // other user's change into one before and after this one.
          offset = opStart - changeStart
          const beforeContent = change.op.i.slice(0, offset)
          const afterContent = change.op.i.slice(offset)

          // The existing change can become the 'before' change
          change.op.i = beforeContent
          movedChanges.push(change)

          // Create a new op afterwards
          const afterChange = {
            op: {
              i: afterContent,
              p: changeStart + offset + opLength,
            },
            metadata: {},
          }
          for (const key in change.metadata) {
            const value = change.metadata[key]
            afterChange.metadata[key] = value
          }
          newChanges.push(afterChange)
        }
      }

      previousChange = change
    }

    if (this.track_changes && !alreadyMerged) {
      this._addOp(op, metadata)
    }
    for ({ op, metadata } of newChanges) {
      this._addOp(op, metadata)
    }

    for (change of removeChanges) {
      if (fixedRemoveChange) {
        this._removeChange(change)
      } else {
        this._brokenRemoveChange(change)
      }
    }

    for (change of movedChanges) {
      this._markAsDirty(change, 'change', 'moved')
    }
  }

  applyDeleteToChanges(op, metadata) {
    const opStart = op.p
    const opLength = op.d.length
    const opEnd = op.p + opLength
    const removeChanges = []
    const fixedRemoveChange = op.fixedRemoveChange
    let movedChanges = []

    // We might end up modifying our delete op if it merges with existing deletes, or cancels out
    // with an existing insert. Since we might do multiple modifications, we record them and do
    // all the modifications after looping through the existing changes, so as not to mess up the
    // offset indexes as we go.
    const opModifications = []
    for (const change of this.changes) {
      let changeStart
      if (change.op.i != null) {
        changeStart = change.op.p
        const changeEnd = changeStart + change.op.i.length
        if (opEnd <= changeStart) {
          // Shift ops after us back by our length
          change.op.p -= opLength
          movedChanges.push(change)
        } else if (opStart >= changeEnd) {
          // Delete is after insert, nothing to do
        } else {
          // When the new delete overlaps an insert, we should remove the part of the insert that
          // is now deleted, and also remove the part of the new delete that overlapped. I.e.
          // the two cancel out where they overlap.
          let deleteRemainingAfter,
            deleteRemainingBefore,
            insertRemainingAfter,
            insertRemainingBefore
          if (opStart >= changeStart) {
            //                            |-- existing insert --|
            // insertRemainingBefore -> |.....||--   new delete   --|
            deleteRemainingBefore = ''
            insertRemainingBefore = change.op.i.slice(0, opStart - changeStart)
          } else {
            // deleteRemainingBefore -> |.....||-- existing insert --|
            //                            |-- new delete   --|
            deleteRemainingBefore = op.d.slice(0, changeStart - opStart)
            insertRemainingBefore = ''
          }

          if (opEnd <= changeEnd) {
            //    |--  existing insert  --|
            // |--  new delete   --||.....| <- insertRemainingAfter
            deleteRemainingAfter = ''
            insertRemainingAfter = change.op.i.slice(opEnd - changeStart)
          } else {
            // |--  existing insert  --||.....| <- deleteRemainingAfter
            //            |--  new delete   --|
            deleteRemainingAfter = op.d.slice(changeEnd - opStart)
            insertRemainingAfter = ''
          }

          const insertRemaining = insertRemainingBefore + insertRemainingAfter
          if (insertRemaining.length > 0) {
            change.op.i = insertRemaining
            change.op.p = Math.min(changeStart, opStart)
            movedChanges.push(change)
          } else {
            removeChanges.push(change)
          }

          // We know what we want to preserve of our delete op before (deleteRemainingBefore) and what we want to preserve
          // afterwards (deleteRemainingBefore). Now we need to turn that into a modification which deletes the
          // chunk in the middle not covered by these.
          const deleteRemovedLength =
            op.d.length -
            deleteRemainingBefore.length -
            deleteRemainingAfter.length
          const deleteRemovedStart = deleteRemainingBefore.length
          const modification = {
            d: op.d.slice(
              deleteRemovedStart,
              deleteRemovedStart + deleteRemovedLength
            ),
            p: deleteRemovedStart,
          }
          if (modification.d.length > 0) {
            opModifications.push(modification)
          }
        }
      } else if (change.op.d != null) {
        changeStart = change.op.p
        if (
          opEnd < changeStart ||
          (!this.track_changes && opEnd === changeStart)
        ) {
          // Shift ops after us back by our length.
          // If we're tracking changes, it must be strictly before, since we'll merge
          // below if they are touching. Otherwise, touching is fine.
          change.op.p -= opLength
          movedChanges.push(change)
        } else if (opStart <= changeStart && changeStart <= opEnd) {
          if (this.track_changes) {
            // If we overlap a delete, add it in our content, and delete the existing change.
            // It's easier to do it this way, rather than modifying the existing delete in case
            // we overlap many deletes and we'd need to track that. We have a workaround to
            // update the delete in place if possible below.
            const offset = changeStart - opStart
            opModifications.push({ i: change.op.d, p: offset })
            removeChanges.push(change)
          } else {
            change.op.p = opStart
            movedChanges.push(change)
          }
        }
      }
    }

    // Copy rather than modify because we still need to apply it to comments
    op = {
      p: op.p,
      d: this._applyOpModifications(op.d, opModifications),
    }

    for (const change of removeChanges) {
      // This is a bit of hack to avoid removing one delete and replacing it with another.
      // If we don't do this, it causes the UI to flicker
      if (
        op.d.length > 0 &&
        change.op.d != null &&
        op.p <= change.op.p &&
        change.op.p <= op.p + op.d.length
      ) {
        change.op.p = op.p
        change.op.d = op.d
        change.metadata = metadata
        movedChanges.push(change)
        op.d = '' // stop it being added
      } else {
        if (fixedRemoveChange) {
          this._removeChange(change)
        } else {
          this._brokenRemoveChange(change)
        }
      }
    }

    if (this.track_changes && op.d.length > 0) {
      this._addOp(op, metadata)
    } else {
      // It's possible that we deleted an insert between two other inserts. I.e.
      // If we delete 'user_2 insert' in:
      //   |-- user_1 insert --||-- user_2 insert --||-- user_1 insert --|
      // it becomes:
      //   |-- user_1 insert --||-- user_1 insert --|
      // We need to merge these together again
      const results = this._scanAndMergeAdjacentUpdates()
      movedChanges = movedChanges.concat(results.movedChanges)
      for (const change of results.removeChanges) {
        if (fixedRemoveChange) {
          this._removeChange(change)
        } else {
          this._brokenRemoveChange(change)
        }
        movedChanges = movedChanges.filter(c => c !== change)
      }
    }

    for (const change of movedChanges) {
      this._markAsDirty(change, 'change', 'moved')
    }
  }

  _addOp(op, metadata) {
    // Don't take a reference to the existing op since we'll modify this in place with future changes
    op = this._clone(op)
    const change = {
      id: this.newId(),
      op,
      metadata: this._clone(metadata),
    }
    this.changes.push(change)

    // Keep ops in order of offset, with deletes before inserts
    this.changes.sort(function (c1, c2) {
      const result = c1.op.p - c2.op.p
      if (result !== 0) {
        return result
      } else if (c1.op.i != null && c2.op.d != null) {
        return 1
      } else if (c1.op.d != null && c2.op.i != null) {
        return -1
      } else {
        return 0
      }
    })

    this._markAsDirty(change, 'change', 'added')
  }

  _removeChange(change) {
    this.changes = this.changes.filter(c => c !== change)
    this._markAsDirty(change, 'change', 'removed')
  }

  _brokenRemoveChange(change) {
    this.changes = this.changes.filter(c => c.id !== change.id)
    this._markAsDirty(change, 'change', 'removed')
  }

  _applyOpModifications(content, opModifications) {
    // Put in descending position order, with deleting first if at the same offset
    // (Inserting first would modify the content that the delete will delete)
    opModifications.sort(function (a, b) {
      const result = b.p - a.p
      if (result !== 0) {
        return result
      } else if (a.i != null && b.d != null) {
        return 1
      } else if (a.d != null && b.i != null) {
        return -1
      } else {
        return 0
      }
    })

    for (const modification of opModifications) {
      if (modification.i != null) {
        content =
          content.slice(0, modification.p) +
          modification.i +
          content.slice(modification.p)
      } else if (modification.d != null) {
        if (
          content.slice(
            modification.p,
            modification.p + modification.d.length
          ) !== modification.d
        ) {
          throw new Error('deletion does not match text in document')
        }
        content =
          content.slice(0, modification.p) +
          content.slice(modification.p + modification.d.length)
      }
    }
    return content
  }

  _scanAndMergeAdjacentUpdates() {
    // This should only need calling when deleting an update between two
    // other updates. There's no other way to get two adjacent updates from the
    // same user, since they would be merged on insert.
    let previousChange = null
    const removeChanges = []
    const movedChanges = []
    for (const change of this.changes) {
      if (previousChange?.op.i != null && change.op.i != null) {
        const previousChangeEnd =
          previousChange.op.p + previousChange.op.i.length
        const previousChangeUserId = previousChange.metadata.user_id
        const changeStart = change.op.p
        const changeUserId = change.metadata.user_id
        if (
          previousChangeEnd === changeStart &&
          previousChangeUserId === changeUserId
        ) {
          removeChanges.push(change)
          previousChange.op.i += change.op.i
          movedChanges.push(previousChange)
        }
      } else if (
        previousChange?.op.d != null &&
        change.op.d != null &&
        previousChange?.op.p === change.op.p
      ) {
        // Merge adjacent deletes
        previousChange.op.d += change.op.d
        removeChanges.push(change)
        movedChanges.push(previousChange)
      } else {
        // Only update to the current change if we haven't removed it.
        previousChange = change
      }
    }
    return { movedChanges, removeChanges }
  }

  resetDirtyState() {
    this._dirtyState = {
      comment: {
        moved: {},
        removed: {},
        added: {},
      },
      change: {
        moved: {},
        removed: {},
        added: {},
      },
    }
  }

  getDirtyState() {
    return this._dirtyState
  }

  getTrackedDeletesLength() {
    let length = 0
    for (const change of this.changes) {
      if (change.op.d != null) {
        length += change.op.d.length
      }
    }
    return length
  }

  _markAsDirty(object, type, action) {
    this._dirtyState[type][action][object.id] = object
  }

  _clone(object) {
    const clone = {}
    for (const k in object) {
      const v = object[k]
      clone[k] = v
    }
    return clone
  }
}

module.exports = RangesTracker
