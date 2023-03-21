// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let RangesManager
const RangesTracker = require('@overleaf/ranges-tracker')
const logger = require('@overleaf/logger')
const Metrics = require('./Metrics')
const _ = require('lodash')

const RANGE_DELTA_BUCKETS = [0, 1, 2, 3, 4, 5, 10, 20, 50]

module.exports = RangesManager = {
  MAX_COMMENTS: 500,
  MAX_CHANGES: 2000,

  applyUpdate(projectId, docId, entries, updates, newDocLines, callback) {
    let error
    if (entries == null) {
      entries = {}
    }
    if (updates == null) {
      updates = []
    }
    if (callback == null) {
      callback = function () {}
    }
    const { changes, comments } = _.cloneDeep(entries)
    const rangesTracker = new RangesTracker(changes, comments)
    const [emptyRangeCountBefore, totalRangeCountBefore] =
      RangesManager._emptyRangesCount(rangesTracker)
    for (const update of Array.from(updates)) {
      rangesTracker.track_changes = !!update.meta.tc
      if (update.meta.tc) {
        rangesTracker.setIdSeed(update.meta.tc)
      }
      for (const op of Array.from(update.op)) {
        try {
          rangesTracker.applyOp(op, {
            user_id: update.meta != null ? update.meta.user_id : undefined,
          })
        } catch (error1) {
          error = error1
          return callback(error)
        }
      }
    }

    if (
      (rangesTracker.changes != null
        ? rangesTracker.changes.length
        : undefined) > RangesManager.MAX_CHANGES ||
      (rangesTracker.comments != null
        ? rangesTracker.comments.length
        : undefined) > RangesManager.MAX_COMMENTS
    ) {
      return callback(new Error('too many comments or tracked changes'))
    }

    try {
      // This is a consistency check that all of our ranges and
      // comments still match the corresponding text
      rangesTracker.validate(newDocLines.join('\n'))
    } catch (error2) {
      error = error2
      logger.error(
        { err: error, projectId, docId, newDocLines, updates },
        'error validating ranges'
      )
      return callback(error)
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
    const response = RangesManager._getRanges(rangesTracker)
    logger.debug(
      {
        projectId,
        docId,
        changesCount:
          response.changes != null ? response.changes.length : undefined,
        commentsCount:
          response.comments != null ? response.comments.length : undefined,
        rangesWereCollapsed,
      },
      'applied updates to ranges'
    )
    return callback(null, response, rangesWereCollapsed)
  },

  acceptChanges(changeIds, ranges, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const { changes, comments } = ranges
    logger.debug(`accepting ${changeIds.length} changes in ranges`)
    const rangesTracker = new RangesTracker(changes, comments)
    rangesTracker.removeChangeIds(changeIds)
    const response = RangesManager._getRanges(rangesTracker)
    return callback(null, response)
  },

  deleteComment(commentId, ranges, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const { changes, comments } = ranges
    logger.debug({ commentId }, 'deleting comment in ranges')
    const rangesTracker = new RangesTracker(changes, comments)
    rangesTracker.removeCommentId(commentId)
    const response = RangesManager._getRanges(rangesTracker)
    return callback(null, response)
  },

  _getRanges(rangesTracker) {
    // Return the minimal data structure needed, since most documents won't have any
    // changes or comments
    let response = {}
    if (
      (rangesTracker.changes != null
        ? rangesTracker.changes.length
        : undefined) > 0
    ) {
      if (response == null) {
        response = {}
      }
      response.changes = rangesTracker.changes
    }
    if (
      (rangesTracker.comments != null
        ? rangesTracker.comments.length
        : undefined) > 0
    ) {
      if (response == null) {
        response = {}
      }
      response.comments = rangesTracker.comments
    }
    return response
  },

  _emptyRangesCount(ranges) {
    let emptyCount = 0
    let totalCount = 0
    for (const comment of Array.from(ranges.comments || [])) {
      totalCount++
      if (comment.op.c === '') {
        emptyCount++
      }
    }
    for (const change of Array.from(ranges.changes || [])) {
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
