const RangesTracker = require('@overleaf/ranges-tracker')
const logger = require('@overleaf/logger')
const Metrics = require('./Metrics')
const _ = require('lodash')

const RANGE_DELTA_BUCKETS = [0, 1, 2, 3, 4, 5, 10, 20, 50]

const RangesManager = {
  MAX_COMMENTS: 500,
  MAX_CHANGES: 2000,

  applyUpdate(projectId, docId, entries, updates, newDocLines) {
    if (entries == null) {
      entries = {}
    }
    if (updates == null) {
      updates = []
    }
    const { changes, comments } = _.cloneDeep(entries)
    const rangesTracker = new RangesTracker(changes, comments)
    const [emptyRangeCountBefore, totalRangeCountBefore] =
      RangesManager._emptyRangesCount(rangesTracker)
    for (const update of updates) {
      rangesTracker.track_changes = !!update.meta.tc
      if (update.meta.tc) {
        rangesTracker.setIdSeed(update.meta.tc)
      }
      for (const op of update.op) {
        rangesTracker.applyOp(op, { user_id: update.meta?.user_id })
      }
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
    return { newRanges, rangesWereCollapsed }
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
    let response = {}
    if (rangesTracker.changes != null && rangesTracker.changes.length > 0) {
      if (response == null) {
        response = {}
      }
      response.changes = rangesTracker.changes
    }
    if (rangesTracker.comments != null && rangesTracker.comments.length > 0) {
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

module.exports = RangesManager
