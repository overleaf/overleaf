// @ts-check

const RangesTracker = require('@overleaf/ranges-tracker')
const logger = require('@overleaf/logger')
const OError = require('@overleaf/o-error')
const Metrics = require('./Metrics')
const _ = require('lodash')
const { isInsert, isDelete, isComment } = require('./Utils')

/**
 * @typedef {import('./types').Comment} Comment
 * @typedef {import('./types').CommentOp} CommentOp
 * @typedef {import('./types').DeleteOp} DeleteOp
 * @typedef {import('./types').HistoryCommentOp} HistoryCommentOp
 * @typedef {import('./types').HistoryDeleteOp} HistoryDeleteOp
 * @typedef {import('./types').HistoryInsertOp} HistoryInsertOp
 * @typedef {import('./types').HistoryOp} HistoryOp
 * @typedef {import('./types').HistoryUpdate} HistoryUpdate
 * @typedef {import('./types').InsertOp} InsertOp
 * @typedef {import('./types').Op} Op
 * @typedef {import('./types').Ranges} Ranges
 * @typedef {import('./types').TrackedChange} TrackedChange
 * @typedef {import('./types').Update} Update
 */

const RANGE_DELTA_BUCKETS = [0, 1, 2, 3, 4, 5, 10, 20, 50]

const RangesManager = {
  MAX_COMMENTS: 500,
  MAX_CHANGES: 2000,

  /**
   * Apply an update to the given doc (lines and ranges) and return new ranges
   *
   * @param {string} projectId
   * @param {string} docId
   * @param {Ranges} ranges - ranges before the updates were applied
   * @param {Update[]} updates
   * @param {string[]} newDocLines - the document lines after the updates were applied
   * @param {object} opts
   * @param {boolean} [opts.historyRangesSupport] - whether history ranges support is enabled
   * @returns {{ newRanges: Ranges, rangesWereCollapsed: boolean, historyUpdates: HistoryUpdate[] }}
   */
  applyUpdate(projectId, docId, ranges, updates, newDocLines, opts = {}) {
    if (ranges == null) {
      ranges = {}
    }
    if (updates == null) {
      updates = []
    }
    const { changes, comments } = _.cloneDeep(ranges)
    const rangesTracker = new RangesTracker(changes, comments)
    const [emptyRangeCountBefore, totalRangeCountBefore] =
      RangesManager._emptyRangesCount(rangesTracker)
    const historyUpdates = []
    for (const update of updates) {
      rangesTracker.track_changes = Boolean(update.meta?.tc)
      if (update.meta?.tc) {
        rangesTracker.setIdSeed(update.meta.tc)
      }
      const historyOps = []
      for (const op of update.op) {
        if (opts.historyRangesSupport) {
          historyOps.push(
            getHistoryOp(op, rangesTracker.comments, rangesTracker.changes)
          )
        } else if (isInsert(op) || isDelete(op)) {
          historyOps.push(op)
        }
        rangesTracker.applyOp(op, { user_id: update.meta?.user_id })
      }
      historyUpdates.push({ ...update, op: historyOps })
    }

    if (
      rangesTracker.changes?.length > RangesManager.MAX_CHANGES ||
      rangesTracker.comments?.length > RangesManager.MAX_COMMENTS
    ) {
      throw new Error('too many comments or tracked changes')
    }

    try {
      // This is a consistency check that all of our ranges and
      // comments still match the corresponding text
      rangesTracker.validate(newDocLines.join('\n'))
    } catch (err) {
      logger.error(
        { err, projectId, docId, newDocLines, updates },
        'error validating ranges'
      )
      throw err
    }

    const [emptyRangeCountAfter, totalRangeCountAfter] =
      RangesManager._emptyRangesCount(rangesTracker)
    const rangesWereCollapsed =
      emptyRangeCountAfter > emptyRangeCountBefore ||
      totalRangeCountAfter + 1 < totalRangeCountBefore // also include the case where multiple ranges were removed
    // monitor the change in range count, we may want to snapshot before large decreases
    if (totalRangeCountAfter < totalRangeCountBefore) {
      Metrics.histogram(
        'range-delta',
        totalRangeCountBefore - totalRangeCountAfter,
        RANGE_DELTA_BUCKETS,
        { status_code: rangesWereCollapsed ? 'saved' : 'unsaved' }
      )
    }
    const newRanges = RangesManager._getRanges(rangesTracker)
    logger.debug(
      {
        projectId,
        docId,
        changesCount: newRanges.changes?.length,
        commentsCount: newRanges.comments?.length,
        rangesWereCollapsed,
      },
      'applied updates to ranges'
    )
    return { newRanges, rangesWereCollapsed, historyUpdates }
  },

  acceptChanges(changeIds, ranges) {
    const { changes, comments } = ranges
    logger.debug(`accepting ${changeIds.length} changes in ranges`)
    const rangesTracker = new RangesTracker(changes, comments)
    rangesTracker.removeChangeIds(changeIds)
    const newRanges = RangesManager._getRanges(rangesTracker)
    return newRanges
  },

  deleteComment(commentId, ranges) {
    const { changes, comments } = ranges
    logger.debug({ commentId }, 'deleting comment in ranges')
    const rangesTracker = new RangesTracker(changes, comments)
    rangesTracker.removeCommentId(commentId)
    const newRanges = RangesManager._getRanges(rangesTracker)
    return newRanges
  },

  _getRanges(rangesTracker) {
    // Return the minimal data structure needed, since most documents won't have any
    // changes or comments

    const response = {}
    if (rangesTracker.changes != null && rangesTracker.changes.length > 0) {
      response.changes = rangesTracker.changes
    }
    if (rangesTracker.comments != null && rangesTracker.comments.length > 0) {
      response.comments = rangesTracker.comments
    }
    return response
  },

  _emptyRangesCount(ranges) {
    let emptyCount = 0
    let totalCount = 0
    for (const comment of ranges.comments || []) {
      totalCount++
      if (comment.op.c === '') {
        emptyCount++
      }
    }
    for (const change of ranges.changes || []) {
      totalCount++
      if (change.op.i != null) {
        if (change.op.i === '') {
          emptyCount++
        }
      }
    }
    return [emptyCount, totalCount]
  },
}

/**
 * Calculate ops to be sent to the history system.
 *
 * @param {Op} op - the editor op
 * @param {TrackedChange[]} changes - the list of tracked changes in the
 *        document before the op is applied. That list, coming from
 *        RangesTracker is ordered by position.
 * @returns {HistoryOp}
 */
function getHistoryOp(op, comments, changes, opts = {}) {
  if (isInsert(op)) {
    return getHistoryOpForInsert(op, comments, changes)
  } else if (isDelete(op)) {
    return getHistoryOpForDelete(op, changes)
  } else if (isComment(op)) {
    return getHistoryOpForComment(op, changes)
  } else {
    throw new OError('Unrecognized op', { op })
  }
}

/**
 * Calculate history ops for an insert
 *
 * Inserts are moved forward by tracked deletes placed strictly before the
 * op. When an insert is made at the same position as a tracked delete, the
 * insert is placed before the tracked delete.
 *
 * We also add a commentIds property when inserts are made inside a comment.
 * The current behaviour is to include the insert in the comment only if the
 * insert is made strictly inside the comment. Inserts made at the edges are
 * not included in the comment.
 *
 * @param {InsertOp} op
 * @param {Comment[]} comments
 * @param {TrackedChange[]} changes
 * @returns {HistoryInsertOp}
 */
function getHistoryOpForInsert(op, comments, changes) {
  let hpos = op.p
  let trackedDeleteRejection = false
  const commentIds = new Set()

  for (const comment of comments) {
    if (comment.op.p < op.p && op.p < comment.op.p + comment.op.c.length) {
      // Insert is inside the comment; add the comment id
      commentIds.add(comment.op.t)
    }
  }

  for (const change of changes) {
    if (!isDelete(change.op)) {
      // We're only interested in tracked deletes
      continue
    }

    if (change.op.p < op.p) {
      // Tracked delete is before the op. Move the op forward.
      hpos += change.op.d.length
    } else if (change.op.p === op.p) {
      // Tracked delete is at the same position as the op. The insert comes before
      // the tracked delete so it doesn't move.
      if (op.u && change.op.d.startsWith(op.i)) {
        // We're undoing and the insert matches the start of the tracked
        // delete. RangesManager treats this as a tracked delete rejection. We
        // will note this in the op so that project-history can take the
        // appropriate action.
        trackedDeleteRejection = true
      }
    } else {
      // Tracked delete is after the insert. Tracked deletes are ordered, so
      // we know that all subsequent tracked deletes will be after the insert
      // and we can bail out.
      break
    }
  }

  /** @type {HistoryInsertOp} */
  const historyOp = { ...op }
  if (commentIds.size > 0) {
    historyOp.commentIds = Array.from(commentIds)
  }
  if (hpos !== op.p) {
    historyOp.hpos = hpos
  }
  if (trackedDeleteRejection) {
    historyOp.trackedDeleteRejection = true
  }
  return historyOp
}

/**
 * Calculate history op for a delete
 *
 * Deletes are moved forward by tracked deletes placed before or at the position of the
 * op. If a tracked delete is inside the delete, the delete is split in parts
 * so that characters are deleted around the tracked delete, but the tracked
 * delete itself is not deleted.
 *
 * @param {DeleteOp} op
 * @param {TrackedChange[]} changes
 * @returns {HistoryDeleteOp}
 */
function getHistoryOpForDelete(op, changes, opts = {}) {
  let hpos = op.p
  const hsplits = []
  for (const change of changes) {
    if (!isDelete(change.op)) {
      // We're only interested in tracked deletes
      continue
    }

    if (change.op.p <= op.p) {
      // Tracked delete is before or at the position of the incoming delete.
      // Move the op forward.
      hpos += change.op.d.length
    } else if (change.op.p < op.p + op.d.length) {
      // Tracked delete inside the deleted text. Record a split for the history system.
      hsplits.push({ offset: change.op.p - op.p, length: change.op.d.length })
    } else {
      // We've seen all tracked deletes before or inside the delete
      break
    }
  }

  /** @type {HistoryDeleteOp} */
  const historyOp = { ...op }
  if (hpos !== op.p) {
    historyOp.hpos = hpos
  }
  if (hsplits.length > 0) {
    historyOp.hsplits = hsplits
  }
  return historyOp
}

/**
 * Calculate history ops for a comment
 *
 * Comments are moved forward by tracked deletes placed before or at the
 * position of the op. If a tracked delete is inside the comment, the length of
 * the comment is extended to include the tracked delete.
 *
 * @param {CommentOp} op
 * @param {TrackedChange[]} changes
 * @returns {HistoryCommentOp}
 */
function getHistoryOpForComment(op, changes) {
  let hpos = op.p
  let hlen = op.c.length
  for (const change of changes) {
    if (!isDelete(change.op)) {
      // We're only interested in tracked deletes
      continue
    }

    if (change.op.p <= op.p) {
      // Tracked delete is before or at the position of the incoming comment.
      // Move the op forward.
      hpos += change.op.d.length
    } else if (change.op.p < op.p + op.c.length) {
      // Tracked comment inside the comment. Extend the length
      hlen += change.op.d.length
    } else {
      // We've seen all tracked deletes before or inside the comment
      break
    }
  }

  /** @type {HistoryCommentOp} */
  const historyOp = { ...op }
  if (hpos !== op.p) {
    historyOp.hpos = hpos
  }
  if (hlen !== op.c.length) {
    historyOp.hlen = hlen
  }
  return historyOp
}

module.exports = RangesManager
