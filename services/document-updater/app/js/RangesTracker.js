/* eslint-disable
    camelcase,
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// This file is shared between document-updater and web, so that the server and client share
// an identical track changes implementation. Do not edit it directly in web or document-updater,
// instead edit it at https://github.com/sharelatex/ranges-tracker, where it has a suite of tests
const load = function () {
  let RangesTracker
  return (RangesTracker = class RangesTracker {
    // The purpose of this class is to track a set of inserts and deletes to a document, like
    // track changes in Word. We store these as a set of ShareJs style ranges:
    //   {i: "foo", p: 42} # Insert 'foo' at offset 42
    //   {d: "bar", p: 37} # Delete 'bar' at offset 37
    // We only track the inserts and deletes, not the whole document, but by being given all
    // updates that are applied to a document, we can update these appropriately.
    //
    // Note that the set of inserts and deletes we store applies to the document as-is at the moment.
    // So inserts correspond to text which is in the document, while deletes correspond to text which
    // is no longer there, so their lengths do not affect the position of later offsets.
    // E.g.
    //             this is the current text of the document
    //                         |-----|            |
    //  {i: "current ", p:12} -^                   ^- {d: "old ", p: 31}
    //
    // Track changes rules (should be consistent with Word):
    //   * When text is inserted at a delete, the text goes to the left of the delete
    //       I.e. "foo|bar" -> "foobaz|bar", where | is the delete, and 'baz' is inserted
    //   * Deleting content flagged as 'inserted' does not create a new delete marker, it only
    //     removes the insert marker. E.g.
    //       * "abdefghijkl"        -> "abfghijkl"        when 'de' is deleted. No delete marker added
    //           |---| <- inserted       |-| <- inserted
    //       * Deletes overlapping regular text and inserted text will insert a delete marker for the
    //         regular text:
    //         "abcdefghijkl"    ->    "abcdejkl"   when 'fghi' is deleted
    //           |----|                  |--||
    //           ^- inserted 'bcdefg'      \ ^- deleted 'hi'
    //                                      \--inserted 'bcde'
    //   * Deletes overlapping other deletes are merged. E.g.
    //      "abcghijkl"        ->   "ahijkl"     when 'bcg is deleted'
    //          | <- delete 'def'     | <- delete 'bcdefg'
    //   * Deletes by another user will consume deletes by the first user
    //   * Inserts by another user will not combine with inserts by the first user. If they are in the
    //     middle of a previous insert by the first user, the original insert will be split into two.
    constructor(changes, comments) {
      if (changes == null) {
        changes = []
      }
      this.changes = changes
      if (comments == null) {
        comments = []
      }
      this.comments = comments
      this.setIdSeed(RangesTracker.generateIdSeed())
      this.resetDirtyState()
    }

    getIdSeed() {
      return this.id_seed
    }

    setIdSeed(seed) {
      this.id_seed = seed
      return (this.id_increment = 0)
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

    getComment(comment_id) {
      let comment = null
      for (const c of Array.from(this.comments)) {
        if (c.id === comment_id) {
          comment = c
          break
        }
      }
      return comment
    }

    removeCommentId(comment_id) {
      const comment = this.getComment(comment_id)
      if (comment == null) {
        return
      }
      this.comments = this.comments.filter(c => c.id !== comment_id)
      return this._markAsDirty(comment, 'comment', 'removed')
    }

    moveCommentId(comment_id, position, text) {
      return (() => {
        const result = []
        for (const comment of Array.from(this.comments)) {
          if (comment.id === comment_id) {
            comment.op.p = position
            comment.op.c = text
            result.push(this._markAsDirty(comment, 'comment', 'moved'))
          } else {
            result.push(undefined)
          }
        }
        return result
      })()
    }

    getChange(change_id) {
      let change = null
      for (const c of Array.from(this.changes)) {
        if (c.id === change_id) {
          change = c
          break
        }
      }
      return change
    }

    getChanges(change_ids) {
      const changes_response = []
      const ids_map = {}

      for (const change_id of Array.from(change_ids)) {
        ids_map[change_id] = true
      }

      for (const change of Array.from(this.changes)) {
        if (ids_map[change.id]) {
          delete ids_map[change.id]
          changes_response.push(change)
        }
      }

      return changes_response
    }

    removeChangeId(change_id) {
      const change = this.getChange(change_id)
      if (change == null) {
        return
      }
      return this._removeChange(change)
    }

    removeChangeIds(change_to_remove_ids) {
      if (
        !(change_to_remove_ids != null
          ? change_to_remove_ids.length
          : undefined) > 0
      ) {
        return
      }
      const i = this.changes.length
      const remove_change_id = {}
      for (const change_id of Array.from(change_to_remove_ids)) {
        remove_change_id[change_id] = true
      }

      const remaining_changes = []

      for (const change of Array.from(this.changes)) {
        if (remove_change_id[change.id]) {
          delete remove_change_id[change.id]
          this._markAsDirty(change, 'change', 'removed')
        } else {
          remaining_changes.push(change)
        }
      }

      return (this.changes = remaining_changes)
    }

    validate(text) {
      let content
      for (const change of Array.from(this.changes)) {
        if (change.op.i != null) {
          content = text.slice(change.op.p, change.op.p + change.op.i.length)
          if (content !== change.op.i) {
            throw new Error(
              `Change (${JSON.stringify(
                change
              )}) doesn't match text (${JSON.stringify(content)})`
            )
          }
        }
      }
      for (const comment of Array.from(this.comments)) {
        content = text.slice(comment.op.p, comment.op.p + comment.op.c.length)
        if (content !== comment.op.c) {
          throw new Error(
            `Comment (${JSON.stringify(
              comment
            )}) doesn't match text (${JSON.stringify(content)})`
          )
        }
      }
      return true
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
        return this.applyInsertToComments(op)
      } else if (op.d != null) {
        this.applyDeleteToChanges(op, metadata)
        return this.applyDeleteToComments(op)
      } else if (op.c != null) {
        return this.addComment(op, metadata)
      } else {
        throw new Error('unknown op type')
      }
    }

    applyOps(ops, metadata) {
      if (metadata == null) {
        metadata = {}
      }
      return Array.from(ops).map(op => this.applyOp(op, metadata))
    }

    addComment(op, metadata) {
      const existing = this.getComment(op.t)
      if (existing != null) {
        this.moveCommentId(op.t, op.p, op.c)
        return existing
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
        return comment
      }
    }

    applyInsertToComments(op) {
      return (() => {
        const result = []
        for (const comment of Array.from(this.comments)) {
          if (op.p <= comment.op.p) {
            comment.op.p += op.i.length
            result.push(this._markAsDirty(comment, 'comment', 'moved'))
          } else if (op.p < comment.op.p + comment.op.c.length) {
            const offset = op.p - comment.op.p
            comment.op.c =
              comment.op.c.slice(0, +(offset - 1) + 1 || undefined) +
              op.i +
              comment.op.c.slice(offset)
            result.push(this._markAsDirty(comment, 'comment', 'moved'))
          } else {
            result.push(undefined)
          }
        }
        return result
      })()
    }

    applyDeleteToComments(op) {
      const op_start = op.p
      const op_length = op.d.length
      const op_end = op.p + op_length
      return (() => {
        const result = []
        for (const comment of Array.from(this.comments)) {
          const comment_start = comment.op.p
          const comment_end = comment.op.p + comment.op.c.length
          const comment_length = comment_end - comment_start
          if (op_end <= comment_start) {
            // delete is fully before comment
            comment.op.p -= op_length
            result.push(this._markAsDirty(comment, 'comment', 'moved'))
          } else if (op_start >= comment_end) {
            // delete is fully after comment, nothing to do
          } else {
            // delete and comment overlap
            var remaining_after, remaining_before
            if (op_start <= comment_start) {
              remaining_before = ''
            } else {
              remaining_before = comment.op.c.slice(0, op_start - comment_start)
            }
            if (op_end >= comment_end) {
              remaining_after = ''
            } else {
              remaining_after = comment.op.c.slice(op_end - comment_start)
            }

            // Check deleted content matches delete op
            const deleted_comment = comment.op.c.slice(
              remaining_before.length,
              comment_length - remaining_after.length
            )
            const offset = Math.max(0, comment_start - op_start)
            const deleted_op_content = op.d
              .slice(offset)
              .slice(0, deleted_comment.length)
            if (deleted_comment !== deleted_op_content) {
              throw new Error('deleted content does not match comment content')
            }

            comment.op.p = Math.min(comment_start, op_start)
            comment.op.c = remaining_before + remaining_after
            result.push(this._markAsDirty(comment, 'comment', 'moved'))
          }
        }
        return result
      })()
    }

    applyInsertToChanges(op, metadata) {
      let change
      const op_start = op.p
      const op_length = op.i.length
      const op_end = op.p + op_length
      const undoing = !!op.u

      let already_merged = false
      let previous_change = null
      const moved_changes = []
      const remove_changes = []
      const new_changes = []

      for (let i = 0; i < this.changes.length; i++) {
        change = this.changes[i]
        const change_start = change.op.p

        if (change.op.d != null) {
          // Shift any deletes after this along by the length of this insert
          if (op_start < change_start) {
            change.op.p += op_length
            moved_changes.push(change)
          } else if (op_start === change_start) {
            // If we are undoing, then we want to cancel any existing delete ranges if we can.
            // Check if the insert matches the start of the delete, and just remove it from the delete instead if so.
            if (
              undoing &&
              change.op.d.length >= op.i.length &&
              change.op.d.slice(0, op.i.length) === op.i
            ) {
              change.op.d = change.op.d.slice(op.i.length)
              change.op.p += op.i.length
              if (change.op.d === '') {
                remove_changes.push(change)
              } else {
                moved_changes.push(change)
              }
              already_merged = true
            } else {
              change.op.p += op_length
              moved_changes.push(change)
            }
          }
        } else if (change.op.i != null) {
          var offset
          const change_end = change_start + change.op.i.length
          const is_change_overlapping =
            op_start >= change_start && op_start <= change_end

          // Only merge inserts if they are from the same user
          const is_same_user = metadata.user_id === change.metadata.user_id

          // If we are undoing, then our changes will be removed from any delete ops just after. In that case, if there is also
          // an insert op just before, then we shouldn't append it to this insert, but instead only cancel the following delete.
          // E.g.
          //                   foo|<--- about to insert 'b' here
          //  inserted 'foo'  --^ ^-- deleted 'bar'
          // should become just 'foo' not 'foob' (with the delete marker becoming just 'ar'), .
          const next_change = this.changes[i + 1]
          const is_op_adjacent_to_next_delete =
            next_change != null &&
            next_change.op.d != null &&
            op.p === change_end &&
            next_change.op.p === op.p
          const will_op_cancel_next_delete =
            undoing &&
            is_op_adjacent_to_next_delete &&
            next_change.op.d.slice(0, op.i.length) === op.i

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
          const is_insert_blocked_by_delete =
            previous_change != null &&
            previous_change.op.d != null &&
            previous_change.op.p === op_end

          // If the insert is overlapping another insert, either at the beginning in the middle or touching the end,
          // then we merge them into one.
          if (
            this.track_changes &&
            is_change_overlapping &&
            !is_insert_blocked_by_delete &&
            !already_merged &&
            !will_op_cancel_next_delete &&
            is_same_user
          ) {
            offset = op_start - change_start
            change.op.i =
              change.op.i.slice(0, offset) + op.i + change.op.i.slice(offset)
            change.metadata.ts = metadata.ts
            already_merged = true
            moved_changes.push(change)
          } else if (op_start <= change_start) {
            // If we're fully before the other insert we can just shift the other insert by our length.
            // If they are touching, and should have been merged, they will have been above.
            // If not merged above, then it must be blocked by a delete, and will be after this insert, so we shift it along as well
            change.op.p += op_length
            moved_changes.push(change)
          } else if (
            (!is_same_user || !this.track_changes) &&
            change_start < op_start &&
            op_start < change_end
          ) {
            // This user is inserting inside a change by another user, so we need to split the
            // other user's change into one before and after this one.
            offset = op_start - change_start
            const before_content = change.op.i.slice(0, offset)
            const after_content = change.op.i.slice(offset)

            // The existing change can become the 'before' change
            change.op.i = before_content
            moved_changes.push(change)

            // Create a new op afterwards
            const after_change = {
              op: {
                i: after_content,
                p: change_start + offset + op_length,
              },
              metadata: {},
            }
            for (const key in change.metadata) {
              const value = change.metadata[key]
              after_change.metadata[key] = value
            }
            new_changes.push(after_change)
          }
        }

        previous_change = change
      }

      if (this.track_changes && !already_merged) {
        this._addOp(op, metadata)
      }
      for ({ op, metadata } of Array.from(new_changes)) {
        this._addOp(op, metadata)
      }

      for (change of Array.from(remove_changes)) {
        this._removeChange(change)
      }

      return (() => {
        const result = []
        for (change of Array.from(moved_changes)) {
          result.push(this._markAsDirty(change, 'change', 'moved'))
        }
        return result
      })()
    }

    applyDeleteToChanges(op, metadata) {
      let change
      const op_start = op.p
      const op_length = op.d.length
      const op_end = op.p + op_length
      const remove_changes = []
      let moved_changes = []

      // We might end up modifying our delete op if it merges with existing deletes, or cancels out
      // with an existing insert. Since we might do multiple modifications, we record them and do
      // all the modifications after looping through the existing changes, so as not to mess up the
      // offset indexes as we go.
      const op_modifications = []
      for (change of Array.from(this.changes)) {
        var change_start
        if (change.op.i != null) {
          change_start = change.op.p
          const change_end = change_start + change.op.i.length
          if (op_end <= change_start) {
            // Shift ops after us back by our length
            change.op.p -= op_length
            moved_changes.push(change)
          } else if (op_start >= change_end) {
            // Delete is after insert, nothing to do
          } else {
            // When the new delete overlaps an insert, we should remove the part of the insert that
            // is now deleted, and also remove the part of the new delete that overlapped. I.e.
            // the two cancel out where they overlap.
            var delete_remaining_after,
              delete_remaining_before,
              insert_remaining_after,
              insert_remaining_before
            if (op_start >= change_start) {
              //                            |-- existing insert --|
              // insert_remaining_before -> |.....||--   new delete   --|
              delete_remaining_before = ''
              insert_remaining_before = change.op.i.slice(
                0,
                op_start - change_start
              )
            } else {
              // delete_remaining_before -> |.....||-- existing insert --|
              //                            |-- new delete   --|
              delete_remaining_before = op.d.slice(0, change_start - op_start)
              insert_remaining_before = ''
            }

            if (op_end <= change_end) {
              //    |--  existing insert  --|
              // |--  new delete   --||.....| <- insert_remaining_after
              delete_remaining_after = ''
              insert_remaining_after = change.op.i.slice(op_end - change_start)
            } else {
              // |--  existing insert  --||.....| <- delete_remaining_after
              //            |--  new delete   --|
              delete_remaining_after = op.d.slice(change_end - op_start)
              insert_remaining_after = ''
            }

            const insert_remaining =
              insert_remaining_before + insert_remaining_after
            if (insert_remaining.length > 0) {
              change.op.i = insert_remaining
              change.op.p = Math.min(change_start, op_start)
              change.metadata.ts = metadata.ts
              moved_changes.push(change)
            } else {
              remove_changes.push(change)
            }

            // We know what we want to preserve of our delete op before (delete_remaining_before) and what we want to preserve
            // afterwards (delete_remaining_before). Now we need to turn that into a modification which deletes the
            // chunk in the middle not covered by these.
            const delete_removed_length =
              op.d.length -
              delete_remaining_before.length -
              delete_remaining_after.length
            const delete_removed_start = delete_remaining_before.length
            const modification = {
              d: op.d.slice(
                delete_removed_start,
                delete_removed_start + delete_removed_length
              ),
              p: delete_removed_start,
            }
            if (modification.d.length > 0) {
              op_modifications.push(modification)
            }
          }
        } else if (change.op.d != null) {
          change_start = change.op.p
          if (
            op_end < change_start ||
            (!this.track_changes && op_end === change_start)
          ) {
            // Shift ops after us back by our length.
            // If we're tracking changes, it must be strictly before, since we'll merge
            // below if they are touching. Otherwise, touching is fine.
            change.op.p -= op_length
            moved_changes.push(change)
          } else if (op_start <= change_start && change_start <= op_end) {
            if (this.track_changes) {
              // If we overlap a delete, add it in our content, and delete the existing change.
              // It's easier to do it this way, rather than modifying the existing delete in case
              // we overlap many deletes and we'd need to track that. We have a workaround to
              // update the delete in place if possible below.
              const offset = change_start - op_start
              op_modifications.push({ i: change.op.d, p: offset })
              remove_changes.push(change)
            } else {
              change.op.p = op_start
              moved_changes.push(change)
            }
          }
        }
      }

      // Copy rather than modify because we still need to apply it to comments
      op = {
        p: op.p,
        d: this._applyOpModifications(op.d, op_modifications),
      }

      for (change of Array.from(remove_changes)) {
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
          moved_changes.push(change)
          op.d = '' // stop it being added
        } else {
          this._removeChange(change)
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
        moved_changes = moved_changes.concat(results.moved_changes)
        for (change of Array.from(results.remove_changes)) {
          this._removeChange(change)
          moved_changes = moved_changes.filter(c => c !== change)
        }
      }

      return (() => {
        const result = []
        for (change of Array.from(moved_changes)) {
          result.push(this._markAsDirty(change, 'change', 'moved'))
        }
        return result
      })()
    }

    _addOp(op, metadata) {
      const change = {
        id: this.newId(),
        op: this._clone(op), // Don't take a reference to the existing op since we'll modify this in place with future changes
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

      return this._markAsDirty(change, 'change', 'added')
    }

    _removeChange(change) {
      this.changes = this.changes.filter(c => c.id !== change.id)
      return this._markAsDirty(change, 'change', 'removed')
    }

    _applyOpModifications(content, op_modifications) {
      // Put in descending position order, with deleting first if at the same offset
      // (Inserting first would modify the content that the delete will delete)
      op_modifications.sort(function (a, b) {
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

      for (const modification of Array.from(op_modifications)) {
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
            throw new Error(
              `deleted content does not match. content: ${JSON.stringify(
                content
              )}; modification: ${JSON.stringify(modification)}`
            )
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
      let previous_change = null
      const remove_changes = []
      const moved_changes = []
      for (const change of Array.from(this.changes)) {
        if (
          (previous_change != null ? previous_change.op.i : undefined) !=
            null &&
          change.op.i != null
        ) {
          const previous_change_end =
            previous_change.op.p + previous_change.op.i.length
          const previous_change_user_id = previous_change.metadata.user_id
          const change_start = change.op.p
          const change_user_id = change.metadata.user_id
          if (
            previous_change_end === change_start &&
            previous_change_user_id === change_user_id
          ) {
            remove_changes.push(change)
            previous_change.op.i += change.op.i
            moved_changes.push(previous_change)
          }
        } else if (
          (previous_change != null ? previous_change.op.d : undefined) !=
            null &&
          change.op.d != null &&
          previous_change.op.p === change.op.p
        ) {
          // Merge adjacent deletes
          previous_change.op.d += change.op.d
          remove_changes.push(change)
          moved_changes.push(previous_change)
        } else {
          // Only update to the current change if we haven't removed it.
          previous_change = change
        }
      }
      return { moved_changes, remove_changes }
    }

    resetDirtyState() {
      return (this._dirtyState = {
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
      })
    }

    getDirtyState() {
      return this._dirtyState
    }

    _markAsDirty(object, type, action) {
      return (this._dirtyState[type][action][object.id] = object)
    }

    _clone(object) {
      const clone = {}
      for (const k in object) {
        const v = object[k]
        clone[k] = v
      }
      return clone
    }
  })
}

if (typeof define !== 'undefined' && define !== null) {
  define([], load)
} else {
  module.exports = load()
}
