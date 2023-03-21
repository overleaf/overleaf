/* eslint-disable
    new-cap,
    no-throw-literal,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let oneMinute, twoMegabytes, UpdateCompressor
const strInject = (s1, pos, s2) => s1.slice(0, pos) + s2 + s1.slice(pos)
const strRemove = (s1, pos, length) => s1.slice(0, pos) + s1.slice(pos + length)

const { diff_match_patch: diffMatchPatch } = require('../lib/diff_match_patch')
const dmp = new diffMatchPatch()

module.exports = UpdateCompressor = {
  NOOP: 'noop',

  // Updates come from the doc updater in format
  // {
  // 	op:   [ { ... op1 ... }, { ... op2 ... } ]
  // 	meta: { ts: ..., user_id: ... }
  // }
  // but it's easier to work with on op per update, so convert these updates to
  // our compressed format
  // [{
  // 	op: op1
  // 	meta: { start_ts: ... , end_ts: ..., user_id: ... }
  // }, {
  // 	op: op2
  // 	meta: { start_ts: ... , end_ts: ..., user_id: ... }
  // }]
  convertToSingleOpUpdates(updates) {
    const splitUpdates = []
    for (const update of Array.from(updates)) {
      // Reject any non-insert or delete ops, i.e. comments
      const ops = update.op.filter(o => o.i != null || o.d != null)
      if (ops.length === 0) {
        splitUpdates.push({
          op: UpdateCompressor.NOOP,
          meta: {
            start_ts: update.meta.start_ts || update.meta.ts,
            end_ts: update.meta.end_ts || update.meta.ts,
            user_id: update.meta.user_id,
          },
          v: update.v,
        })
      } else {
        for (const op of Array.from(ops)) {
          splitUpdates.push({
            op,
            meta: {
              start_ts: update.meta.start_ts || update.meta.ts,
              end_ts: update.meta.end_ts || update.meta.ts,
              user_id: update.meta.user_id,
            },
            v: update.v,
          })
        }
      }
    }
    return splitUpdates
  },

  concatUpdatesWithSameVersion(updates) {
    const concattedUpdates = []
    for (const update of Array.from(updates)) {
      const lastUpdate = concattedUpdates[concattedUpdates.length - 1]
      if (lastUpdate != null && lastUpdate.v === update.v) {
        if (update.op !== UpdateCompressor.NOOP) {
          lastUpdate.op.push(update.op)
        }
      } else {
        const nextUpdate = {
          op: [],
          meta: update.meta,
          v: update.v,
        }
        if (update.op !== UpdateCompressor.NOOP) {
          nextUpdate.op.push(update.op)
        }
        concattedUpdates.push(nextUpdate)
      }
    }
    return concattedUpdates
  },

  compressRawUpdates(lastPreviousUpdate, rawUpdates) {
    if (lastPreviousUpdate?.op?.length > 1) {
      // if the last previous update was an array op, don't compress onto it.
      // The avoids cases where array length changes but version number doesn't
      return [lastPreviousUpdate].concat(
        UpdateCompressor.compressRawUpdates(null, rawUpdates)
      )
    }
    if (lastPreviousUpdate != null) {
      rawUpdates = [lastPreviousUpdate].concat(rawUpdates)
    }
    let updates = UpdateCompressor.convertToSingleOpUpdates(rawUpdates)
    updates = UpdateCompressor.compressUpdates(updates)
    return UpdateCompressor.concatUpdatesWithSameVersion(updates)
  },

  compressUpdates(updates) {
    if (updates.length === 0) {
      return []
    }

    let compressedUpdates = [updates.shift()]
    for (const update of Array.from(updates)) {
      const lastCompressedUpdate = compressedUpdates.pop()
      if (lastCompressedUpdate != null) {
        compressedUpdates = compressedUpdates.concat(
          UpdateCompressor._concatTwoUpdates(lastCompressedUpdate, update)
        )
      } else {
        compressedUpdates.push(update)
      }
    }

    return compressedUpdates
  },

  MAX_TIME_BETWEEN_UPDATES: (oneMinute = 60 * 1000),
  MAX_UPDATE_SIZE: (twoMegabytes = 2 * 1024 * 1024),

  _concatTwoUpdates(firstUpdate, secondUpdate) {
    let offset
    firstUpdate = {
      op: firstUpdate.op,
      meta: {
        user_id: firstUpdate.meta.user_id || null,
        start_ts: firstUpdate.meta.start_ts || firstUpdate.meta.ts,
        end_ts: firstUpdate.meta.end_ts || firstUpdate.meta.ts,
      },
      v: firstUpdate.v,
    }
    secondUpdate = {
      op: secondUpdate.op,
      meta: {
        user_id: secondUpdate.meta.user_id || null,
        start_ts: secondUpdate.meta.start_ts || secondUpdate.meta.ts,
        end_ts: secondUpdate.meta.end_ts || secondUpdate.meta.ts,
      },
      v: secondUpdate.v,
    }

    if (firstUpdate.meta.user_id !== secondUpdate.meta.user_id) {
      return [firstUpdate, secondUpdate]
    }

    if (
      secondUpdate.meta.start_ts - firstUpdate.meta.end_ts >
      UpdateCompressor.MAX_TIME_BETWEEN_UPDATES
    ) {
      return [firstUpdate, secondUpdate]
    }

    const firstOp = firstUpdate.op
    const secondOp = secondUpdate.op

    const firstSize =
      (firstOp.i != null ? firstOp.i.length : undefined) ||
      (firstOp.d != null ? firstOp.d.length : undefined)
    const secondSize =
      (secondOp.i != null ? secondOp.i.length : undefined) ||
      (secondOp.d != null ? secondOp.d.length : undefined)

    // Two inserts
    if (
      firstOp.i != null &&
      secondOp.i != null &&
      firstOp.p <= secondOp.p &&
      secondOp.p <= firstOp.p + firstOp.i.length &&
      firstSize + secondSize < UpdateCompressor.MAX_UPDATE_SIZE
    ) {
      return [
        {
          meta: {
            start_ts: firstUpdate.meta.start_ts,
            end_ts: secondUpdate.meta.end_ts,
            user_id: firstUpdate.meta.user_id,
          },
          op: {
            p: firstOp.p,
            i: strInject(firstOp.i, secondOp.p - firstOp.p, secondOp.i),
          },
          v: secondUpdate.v,
        },
      ]
      // Two deletes
    } else if (
      firstOp.d != null &&
      secondOp.d != null &&
      secondOp.p <= firstOp.p &&
      firstOp.p <= secondOp.p + secondOp.d.length &&
      firstSize + secondSize < UpdateCompressor.MAX_UPDATE_SIZE
    ) {
      return [
        {
          meta: {
            start_ts: firstUpdate.meta.start_ts,
            end_ts: secondUpdate.meta.end_ts,
            user_id: firstUpdate.meta.user_id,
          },
          op: {
            p: secondOp.p,
            d: strInject(secondOp.d, firstOp.p - secondOp.p, firstOp.d),
          },
          v: secondUpdate.v,
        },
      ]
      // An insert and then a delete
    } else if (
      firstOp.i != null &&
      secondOp.d != null &&
      firstOp.p <= secondOp.p &&
      secondOp.p <= firstOp.p + firstOp.i.length
    ) {
      offset = secondOp.p - firstOp.p
      const insertedText = firstOp.i.slice(offset, offset + secondOp.d.length)
      // Only trim the insert when the delete is fully contained within in it
      if (insertedText === secondOp.d) {
        const insert = strRemove(firstOp.i, offset, secondOp.d.length)
        return [
          {
            meta: {
              start_ts: firstUpdate.meta.start_ts,
              end_ts: secondUpdate.meta.end_ts,
              user_id: firstUpdate.meta.user_id,
            },
            op: {
              p: firstOp.p,
              i: insert,
            },
            v: secondUpdate.v,
          },
        ]
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
      const diffOps = this.diffAsShareJsOps(firstOp.d, secondOp.i)
      if (diffOps.length === 0) {
        return [
          {
            // Noop
            meta: {
              start_ts: firstUpdate.meta.start_ts,
              end_ts: secondUpdate.meta.end_ts,
              user_id: firstUpdate.meta.user_id,
            },
            op: {
              p: firstOp.p,
              i: '',
            },
            v: secondUpdate.v,
          },
        ]
      } else {
        return diffOps.map(function (op) {
          op.p += offset
          return {
            meta: {
              start_ts: firstUpdate.meta.start_ts,
              end_ts: secondUpdate.meta.end_ts,
              user_id: firstUpdate.meta.user_id,
            },
            op,
            v: secondUpdate.v,
          }
        })
      }
    } else {
      return [firstUpdate, secondUpdate]
    }
  },

  ADDED: 1,
  REMOVED: -1,
  UNCHANGED: 0,
  diffAsShareJsOps(before, after, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const diffs = dmp.diff_main(before, after)
    dmp.diff_cleanupSemantic(diffs)

    const ops = []
    let position = 0
    for (const diff of Array.from(diffs)) {
      const type = diff[0]
      const content = diff[1]
      if (type === this.ADDED) {
        ops.push({
          i: content,
          p: position,
        })
        position += content.length
      } else if (type === this.REMOVED) {
        ops.push({
          d: content,
          p: position,
        })
      } else if (type === this.UNCHANGED) {
        position += content.length
      } else {
        throw 'Unknown type'
      }
    }
    return ops
  },
}
