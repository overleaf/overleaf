/* eslint-disable
    camelcase,
    handle-callback-err,
*/
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
const RangesTracker = require('./RangesTracker')
const logger = require('logger-sharelatex')
const _ = require('lodash')

module.exports = RangesManager = {
  MAX_COMMENTS: 500,
  MAX_CHANGES: 2000,

  applyUpdate(project_id, doc_id, entries, updates, newDocLines, callback) {
    let error
    if (entries == null) {
      entries = {}
    }
    if (updates == null) {
      updates = []
    }
    if (callback == null) {
      callback = function (error, new_entries, ranges_were_collapsed) {}
    }
    const { changes, comments } = _.cloneDeep(entries)
    const rangesTracker = new RangesTracker(changes, comments)
    const emptyRangeCountBefore = RangesManager._emptyRangesCount(rangesTracker)
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
        { err: error, project_id, doc_id, newDocLines, updates },
        'error validating ranges'
      )
      return callback(error)
    }

    const emptyRangeCountAfter = RangesManager._emptyRangesCount(rangesTracker)
    const rangesWereCollapsed = emptyRangeCountAfter > emptyRangeCountBefore
    const response = RangesManager._getRanges(rangesTracker)
    logger.log(
      {
        project_id,
        doc_id,
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

  acceptChanges(change_ids, ranges, callback) {
    if (callback == null) {
      callback = function (error, ranges) {}
    }
    const { changes, comments } = ranges
    logger.log(`accepting ${change_ids.length} changes in ranges`)
    const rangesTracker = new RangesTracker(changes, comments)
    rangesTracker.removeChangeIds(change_ids)
    const response = RangesManager._getRanges(rangesTracker)
    return callback(null, response)
  },

  deleteComment(comment_id, ranges, callback) {
    if (callback == null) {
      callback = function (error, ranges) {}
    }
    const { changes, comments } = ranges
    logger.log({ comment_id }, 'deleting comment in ranges')
    const rangesTracker = new RangesTracker(changes, comments)
    rangesTracker.removeCommentId(comment_id)
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
    let count = 0
    for (const comment of Array.from(ranges.comments || [])) {
      if (comment.op.c === '') {
        count++
      }
    }
    for (const change of Array.from(ranges.changes || [])) {
      if (change.op.i != null) {
        if (change.op.i === '') {
          count++
        }
      }
    }
    return count
  },
}
