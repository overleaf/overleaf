// @ts-check

import OError from '@overleaf/o-error'
import DMP from 'diff-match-patch'

/**
 * @import { DeleteOp, InsertOp, Op, Update } from './types'
 */

const MAX_TIME_BETWEEN_UPDATES = 60 * 1000 // one minute
const MAX_UPDATE_SIZE = 2 * 1024 * 1024 // 2 MB
const ADDED = 1
const REMOVED = -1
const UNCHANGED = 0

const strInject = (s1, pos, s2) => s1.slice(0, pos) + s2 + s1.slice(pos)
const strRemove = (s1, pos, length) => s1.slice(0, pos) + s1.slice(pos + length)

const dmp = new DMP()
dmp.Diff_Timeout = 0.1 // prevent the diff algorithm from searching too hard for changes in unrelated content

const cloneWithOp = function (update, op) {
  // to improve performance, shallow clone the update
  // and its meta property (also an object), then
  // overwrite the op property directly.
  update = Object.assign({}, update)
  update.meta = Object.assign({}, update.meta)
  update.op = op
  return update
}
const mergeUpdatesWithOp = function (firstUpdate, secondUpdate, op) {
  // We want to take doc_length and ts from the firstUpdate, v and doc_hash from the second
  const update = cloneWithOp(firstUpdate, op)
  if (secondUpdate.v != null) {
    update.v = secondUpdate.v
  }
  if (secondUpdate.meta.doc_hash != null) {
    update.meta.doc_hash = secondUpdate.meta.doc_hash
  } else {
    delete update.meta.doc_hash
  }
  return update
}

/**
 * Adjust the given length to account for the given op
 *
 * The resulting length is the new length of the doc after the op is applied.
 *
 * @param {number} length
 * @param {Op} op
 * @param {object} opts
 * @param {boolean} [opts.tracked] - whether or not the update is a tracked change
 * @returns {number} the adjusted length
 */
function adjustLengthByOp(length, op, opts = {}) {
  if ('i' in op && op.i != null) {
    if (op.trackedDeleteRejection) {
      // Tracked delete rejection: will be translated into a retain
      return length
    } else {
      return length + op.i.length
    }
  } else if ('d' in op && op.d != null) {
    if (opts.tracked) {
      // Tracked delete: will be translated into a retain, except where it overlaps tracked inserts.
      for (const change of op.trackedChanges ?? []) {
        if (change.type === 'insert') {
          length -= change.length
        }
      }
      return length
    } else {
      return length - op.d.length
    }
  } else if ('r' in op && op.r != null) {
    return length
  } else if ('c' in op && op.c != null) {
    return length
  } else {
    throw new OError('unexpected op type')
  }
}

/**
 * Updates come from the doc updater in format
 * {
 * 	op:   [ { ... op1 ... }, { ... op2 ... } ]
 * 	meta: { ts: ..., user_id: ... }
 * }
 * but it's easier to work with on op per update, so convert these updates to
 * our compressed format
 * [{
 * 	op: op1
 * 	meta: { ts: ..., user_id: ... }
 * }, {
 * 	op: op2
 * 	meta: { ts: ..., user_id: ... }
 * }]
 *
 * @param {Update[]} updates
 * @returns {Update[]} single op updates
 */
export function convertToSingleOpUpdates(updates) {
  const splitUpdates = []
  for (const update of updates) {
    if (!('op' in update)) {
      // Not a text op, likely a project strucure op
      splitUpdates.push(update)
      continue
    }
    const ops = update.op

    let docLength = update.meta.history_doc_length ?? update.meta.doc_length
    // Temporary fix for document-updater sending a length of -1 for empty
    // documents. This can be removed after all queues have been flushed.
    if (docLength === -1) {
      docLength = 0
    }
    const docHash = update.meta.doc_hash
    for (const op of ops) {
      const splitUpdate = cloneWithOp(update, op)
      // Only the last update will keep the doc_hash property
      delete splitUpdate.meta.doc_hash
      if (docLength != null) {
        splitUpdate.meta.doc_length = docLength
        docLength = adjustLengthByOp(docLength, op, {
          tracked: update.meta.tc != null,
        })
        delete splitUpdate.meta.history_doc_length
      }
      splitUpdates.push(splitUpdate)
    }
    if (docHash != null && splitUpdates.length > 0) {
      splitUpdates[splitUpdates.length - 1].meta.doc_hash = docHash
    }
  }
  return splitUpdates
}

export function filterBlankUpdates(updates) {
  // Diffing an insert and delete can return blank inserts and deletes
  // which the OL history service doesn't have an equivalent for.
  //
  // NOTE: this relies on the updates only containing either op.i or op.d entries
  // but not both, which is the case because diffAsShareJsOps does this
  return updates.filter(
    update => !(update.op && (update.op.i === '' || update.op.d === ''))
  )
}

export function concatUpdatesWithSameVersion(updates) {
  const concattedUpdates = []
  for (let update of updates) {
    if (update.op != null) {
      update = cloneWithOp(update, [update.op])

      const lastUpdate = concattedUpdates[concattedUpdates.length - 1]
      if (
        lastUpdate != null &&
        lastUpdate.op != null &&
        lastUpdate.v === update.v &&
        lastUpdate.doc === update.doc &&
        lastUpdate.pathname === update.pathname
      ) {
        lastUpdate.op = lastUpdate.op.concat(update.op)
        if (update.meta.doc_hash == null) {
          delete lastUpdate.meta.doc_hash
        } else {
          lastUpdate.meta.doc_hash = update.meta.doc_hash
        }
      } else {
        concattedUpdates.push(update)
      }
    } else {
      concattedUpdates.push(update)
    }
  }
  return concattedUpdates
}

export function compressRawUpdates(rawUpdates) {
  let updates = convertToSingleOpUpdates(rawUpdates)
  updates = compressUpdates(updates)
  updates = filterBlankUpdates(updates)
  updates = concatUpdatesWithSameVersion(updates)
  return updates
}

export function compressUpdates(updates) {
  if (updates.length === 0) {
    return []
  }

  let compressedUpdates = [updates.shift()]
  for (const update of updates) {
    const lastCompressedUpdate = compressedUpdates.pop()
    if (lastCompressedUpdate != null) {
      const newCompressedUpdates = _concatTwoUpdates(
        lastCompressedUpdate,
        update
      )

      compressedUpdates = compressedUpdates.concat(newCompressedUpdates)
    } else {
      compressedUpdates.push(update)
    }
  }

  return compressedUpdates
}

/**
 * If possible, merge two updates into a single update that has the same effect.
 *
 * It's useful to do some of this work at this point while we're dealing with
 * document-updater updates. The deletes, in particular include the deleted
 * text. This allows us to find pieces of inserts and deletes that cancel each
 * other out because they insert/delete the exact same text. This compression
 * makes the diff smaller.
 */
function _concatTwoUpdates(firstUpdate, secondUpdate) {
  // Previously we cloned firstUpdate and secondUpdate at this point but we
  // can skip this step because whenever they are returned with
  // modification there is always a clone at that point via
  // mergeUpdatesWithOp.

  if (firstUpdate.op == null || secondUpdate.op == null) {
    // Project structure ops
    return [firstUpdate, secondUpdate]
  }

  if (
    firstUpdate.doc !== secondUpdate.doc ||
    firstUpdate.pathname !== secondUpdate.pathname
  ) {
    return [firstUpdate, secondUpdate]
  }

  if (firstUpdate.meta.user_id !== secondUpdate.meta.user_id) {
    return [firstUpdate, secondUpdate]
  }

  if (
    (firstUpdate.meta.type === 'external' &&
      secondUpdate.meta.type !== 'external') ||
    (firstUpdate.meta.type !== 'external' &&
      secondUpdate.meta.type === 'external') ||
    (firstUpdate.meta.type === 'external' &&
      secondUpdate.meta.type === 'external' &&
      firstUpdate.meta.source !== secondUpdate.meta.source)
  ) {
    return [firstUpdate, secondUpdate]
  }

  if (secondUpdate.meta.ts - firstUpdate.meta.ts > MAX_TIME_BETWEEN_UPDATES) {
    return [firstUpdate, secondUpdate]
  }

  if (
    (firstUpdate.meta.tc == null && secondUpdate.meta.tc != null) ||
    (firstUpdate.meta.tc != null && secondUpdate.meta.tc == null)
  ) {
    // One update is tracking changes and the other isn't. Tracking changes
    // results in different behaviour in the history, so we need to keep these
    // two updates separate.
    return [firstUpdate, secondUpdate]
  }

  if (Boolean(firstUpdate.op.u) !== Boolean(secondUpdate.op.u)) {
    // One update is an undo and the other isn't. If we were to merge the two
    // updates, we would have to choose one value for the flag, which would be
    // partially incorrect. Moreover, a tracked delete that is also an undo is
    // treated as a tracked insert rejection by the history, so these updates
    // need to be well separated.
    return [firstUpdate, secondUpdate]
  }

  if (
    firstUpdate.op.trackedDeleteRejection ||
    secondUpdate.op.trackedDeleteRejection
  ) {
    // Do not merge tracked delete rejections. Each tracked delete rejection is
    // a separate operation.
    return [firstUpdate, secondUpdate]
  }

  if (
    firstUpdate.op.trackedChanges != null ||
    secondUpdate.op.trackedChanges != null
  ) {
    // Do not merge ops that span tracked changes.
    // TODO: This could theoretically be handled, but it would be complex. One
    // would need to take tracked deletes into account when merging inserts and
    // deletes together.
    return [firstUpdate, secondUpdate]
  }

  const firstOp = firstUpdate.op
  const secondOp = secondUpdate.op
  const firstSize =
    (firstOp.i && firstOp.i.length) || (firstOp.d && firstOp.d.length)
  const secondSize =
    (secondOp.i && secondOp.i.length) || (secondOp.d && secondOp.d.length)
  const firstOpInsideSecondOp =
    secondOp.p <= firstOp.p && firstOp.p <= secondOp.p + secondSize
  const secondOpInsideFirstOp =
    firstOp.p <= secondOp.p && secondOp.p <= firstOp.p + firstSize
  const combinedLengthUnderLimit = firstSize + secondSize < MAX_UPDATE_SIZE

  // Two inserts
  if (
    firstOp.i != null &&
    secondOp.i != null &&
    secondOpInsideFirstOp &&
    combinedLengthUnderLimit &&
    insertOpsInsideSameComments(firstOp, secondOp)
  ) {
    return [
      mergeUpdatesWithOp(firstUpdate, secondUpdate, {
        ...firstOp,
        i: strInject(firstOp.i, secondOp.p - firstOp.p, secondOp.i),
      }),
    ]
  }

  // Two deletes
  if (
    firstOp.d != null &&
    secondOp.d != null &&
    firstOpInsideSecondOp &&
    combinedLengthUnderLimit &&
    firstUpdate.meta.tc == null &&
    secondUpdate.meta.tc == null
  ) {
    return [
      mergeUpdatesWithOp(firstUpdate, secondUpdate, {
        ...secondOp,
        d: strInject(secondOp.d, firstOp.p - secondOp.p, firstOp.d),
      }),
    ]
  }

  // An insert and then a delete
  if (
    firstOp.i != null &&
    secondOp.d != null &&
    secondOpInsideFirstOp &&
    firstUpdate.meta.tc == null &&
    secondUpdate.meta.tc == null
  ) {
    const offset = secondOp.p - firstOp.p
    const insertedText = firstOp.i.slice(offset, offset + secondOp.d.length)
    // Only trim the insert when the delete is fully contained within in it
    if (insertedText === secondOp.d) {
      const insert = strRemove(firstOp.i, offset, secondOp.d.length)
      if (insert === '') {
        return []
      } else {
        return [
          mergeUpdatesWithOp(firstUpdate, secondUpdate, {
            ...firstOp,
            i: insert,
          }),
        ]
      }
    } else {
      // This will only happen if the delete extends outside the insert
      return [firstUpdate, secondUpdate]
    }
  }

  // A delete then an insert at the same place, likely a copy-paste of a chunk of content
  if (
    firstOp.d != null &&
    secondOp.i != null &&
    firstOp.p === secondOp.p &&
    firstUpdate.meta.tc == null &&
    secondUpdate.meta.tc == null
  ) {
    const offset = firstOp.p
    const hoffset = firstOp.hpos
    const diffUpdates = diffAsShareJsOps(firstOp.d, secondOp.i).map(
      function (op) {
        // diffAsShareJsOps() returns ops with positions relative to the position
        // of the copy/paste. We need to adjust these positions so that they
        // apply to the whole document instead.
        const pos = op.p
        op.p = pos + offset
        if (hoffset != null) {
          op.hpos = pos + hoffset
        }
        if (firstOp.u && secondOp.u) {
          op.u = true
        }
        if ('i' in op && secondOp.commentIds != null) {
          // Make sure that commentIds metadata is propagated to inserts
          op.commentIds = secondOp.commentIds
        }
        const update = mergeUpdatesWithOp(firstUpdate, secondUpdate, op)
        // Set the doc hash only on the last update
        delete update.meta.doc_hash
        return update
      }
    )
    const docHash = secondUpdate.meta.doc_hash
    if (docHash != null && diffUpdates.length > 0) {
      diffUpdates[diffUpdates.length - 1].meta.doc_hash = docHash
    }

    // Doing a diff like this loses track of the doc lengths for each
    // update, so recalculate them
    let docLength =
      firstUpdate.meta.history_doc_length ?? firstUpdate.meta.doc_length
    for (const update of diffUpdates) {
      update.meta.doc_length = docLength
      docLength = adjustLengthByOp(docLength, update.op, {
        tracked: update.meta.tc != null,
      })
      delete update.meta.history_doc_length
    }

    return diffUpdates
  }

  return [firstUpdate, secondUpdate]
}

/**
 * Return the diff between two strings
 *
 * @param {string} before
 * @param {string} after
 * @returns {(InsertOp | DeleteOp)[]} the ops that generate that diff
 */
export function diffAsShareJsOps(before, after) {
  const diffs = dmp.diff_main(before, after)
  dmp.diff_cleanupSemantic(diffs)

  const ops = []
  let position = 0
  for (const diff of diffs) {
    const type = diff[0]
    const content = diff[1]
    if (type === ADDED) {
      ops.push({
        i: content,
        p: position,
      })
      position += content.length
    } else if (type === REMOVED) {
      ops.push({
        d: content,
        p: position,
      })
    } else if (type === UNCHANGED) {
      position += content.length
    } else {
      throw new Error('Unknown type')
    }
  }
  return ops
}

/**
 * Checks if two insert ops are inside the same comments
 *
 * @param {InsertOp} op1
 * @param {InsertOp} op2
 * @returns {boolean}
 */
function insertOpsInsideSameComments(op1, op2) {
  const commentIds1 = op1.commentIds
  const commentIds2 = op2.commentIds
  if (commentIds1 == null && commentIds2 == null) {
    // None are inside comments
    return true
  }

  if (
    commentIds1 != null &&
    commentIds2 != null &&
    commentIds1.every(id => commentIds2.includes(id)) &&
    commentIds2.every(id => commentIds1.includes(id))
  ) {
    // Both are inside the same comments
    return true
  }

  return false
}
