/* eslint-disable
    no-return-assign,
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
import _ from 'lodash'
import mongodb from './mongodb.js'

const { ObjectId } = mongodb

let RangeManager

export default RangeManager = {
  shouldUpdateRanges(docRanges, incomingRanges) {
    if (incomingRanges == null) {
      throw new Error('expected incoming_ranges')
    }

    // If the ranges are empty, we don't store them in the DB, so set
    // doc_ranges to an empty object as default, since this is was the
    // incoming_ranges will be for an empty range set.
    if (docRanges == null) {
      docRanges = {}
    }

    return !_.isEqual(docRanges, incomingRanges)
  },

  jsonRangesToMongo(ranges) {
    if (ranges == null) {
      return null
    }

    const updateMetadata = function (metadata) {
      if ((metadata != null ? metadata.ts : undefined) != null) {
        metadata.ts = new Date(metadata.ts)
      }
      if ((metadata != null ? metadata.user_id : undefined) != null) {
        return (metadata.user_id = RangeManager._safeObjectId(metadata.user_id))
      }
    }

    for (const change of Array.from(ranges.changes || [])) {
      change.id = RangeManager._safeObjectId(change.id)
      updateMetadata(change.metadata)
    }
    for (const comment of Array.from(ranges.comments || [])) {
      // Two bugs resulted in mismatched ids, prefer the thread id from the op: https://github.com/overleaf/internal/issues/23272
      comment.id = RangeManager._safeObjectId(comment.op?.t || comment.id)
      if (comment.op) comment.op.t = comment.id

      // resolved property is added to comments when they are obtained from history, but this state doesn't belong in mongo docs collection
      // more info: https://github.com/overleaf/internal/issues/24371#issuecomment-2913095174
      delete comment.op?.resolved
      updateMetadata(comment.metadata)
    }
    return ranges
  },

  fixCommentIds(doc) {
    for (const comment of doc?.ranges?.comments || []) {
      // Two bugs resulted in mismatched ids, prefer the thread id from the op: https://github.com/overleaf/internal/issues/23272
      if (comment.op?.t) comment.id = comment.op.t
    }
  },

  _safeObjectId(data) {
    try {
      return new ObjectId(data)
    } catch (error) {
      return data
    }
  },
}
