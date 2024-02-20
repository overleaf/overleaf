import OError from '@overleaf/o-error'
import DMP from 'diff-match-patch'

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
  // We want to take doc_length and ts from the firstUpdate, v from the second
  const update = cloneWithOp(firstUpdate, op)
  if (secondUpdate.v != null) {
    update.v = secondUpdate.v
  }
  return update
}

const adjustLengthByOp = function (length, op) {
  if (op.i != null) {
    return length + op.i.length
  } else if (op.d != null) {
    return length - op.d.length
  } else if (op.c != null) {
    return length
  } else {
    throw new OError('unexpected op type')
  }
}

// Updates come from the doc updater in format
// {
// 	op:   [ { ... op1 ... }, { ... op2 ... } ]
// 	meta: { ts: ..., user_id: ... }
// }
// but it's easier to work with on op per update, so convert these updates to
// our compressed format
// [{
// 	op: op1
// 	meta: { ts: ..., user_id: ... }
// }, {
// 	op: op2
// 	meta: { ts: ..., user_id: ... }
// }]
export function convertToSingleOpUpdates(updates) {
  const splitUpdates = []
  for (const update of updates) {
    if (update.op == null) {
      // Not a text op, likely a project strucure op
      splitUpdates.push(update)
      continue
    }
    const ops = update.op
    let { doc_length: docLength } = update.meta
    for (const op of ops) {
      const splitUpdate = cloneWithOp(update, op)
      if (docLength != null) {
        splitUpdate.meta.doc_length = docLength
        docLength = adjustLengthByOp(docLength, op)
      }
      splitUpdates.push(splitUpdate)
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

function _concatTwoUpdates(firstUpdate, secondUpdate) {
  // Previously we cloned firstUpdate and secondUpdate at this point but we
  // can skip this step because whenever they are returned with
  // modification there is always a clone at that point via
  // mergeUpdatesWithOp.

  let offset
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
    combinedLengthUnderLimit
  ) {
    return [
      mergeUpdatesWithOp(firstUpdate, secondUpdate, {
        p: firstOp.p,
        i: strInject(firstOp.i, secondOp.p - firstOp.p, secondOp.i),
      }),
    ]
    // Two deletes
  } else if (
    firstOp.d != null &&
    secondOp.d != null &&
    firstOpInsideSecondOp &&
    combinedLengthUnderLimit
  ) {
    return [
      mergeUpdatesWithOp(firstUpdate, secondUpdate, {
        p: secondOp.p,
        d: strInject(secondOp.d, firstOp.p - secondOp.p, firstOp.d),
      }),
    ]
    // An insert and then a delete
  } else if (firstOp.i != null && secondOp.d != null && secondOpInsideFirstOp) {
    offset = secondOp.p - firstOp.p
    const insertedText = firstOp.i.slice(offset, offset + secondOp.d.length)
    // Only trim the insert when the delete is fully contained within in it
    if (insertedText === secondOp.d) {
      const insert = strRemove(firstOp.i, offset, secondOp.d.length)
      if (insert === '') {
        return []
      } else {
        return [
          mergeUpdatesWithOp(firstUpdate, secondUpdate, {
            p: firstOp.p,
            i: insert,
          }),
        ]
      }
    } else {
      // This will only happen if the delete extends outside the insert
      return [firstUpdate, secondUpdate]
    }

    // A delete then an insert at the same place, likely a copy-paste of a chunk of content
  } else if (
    firstOp.d != null &&
    secondOp.i != null &&
    firstOp.p === secondOp.p
  ) {
    offset = firstOp.p
    const diffUpdates = diffAsShareJsOps(firstOp.d, secondOp.i).map(function (
      op
    ) {
      op.p += offset
      return mergeUpdatesWithOp(firstUpdate, secondUpdate, op)
    })

    // Doing a diff like this loses track of the doc lengths for each
    // update, so recalculate them
    let { doc_length: docLength } = firstUpdate.meta
    for (const update of diffUpdates) {
      update.meta.doc_length = docLength
      docLength = adjustLengthByOp(docLength, update.op)
    }

    return diffUpdates
  } else {
    return [firstUpdate, secondUpdate]
  }
}

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
