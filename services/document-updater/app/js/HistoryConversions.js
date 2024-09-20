// @ts-check

const _ = require('lodash')
const { isDelete } = require('./Utils')

/**
 * @import { Comment, HistoryComment, HistoryRanges, HistoryTrackedChange } from './types'
 * @import { Ranges, TrackedChange } from './types'
 */

/**
 * Convert editor ranges to history ranges
 *
 * @param {Ranges} ranges
 * @return {HistoryRanges}
 */
function toHistoryRanges(ranges) {
  const changes = ranges.changes ?? []
  const comments = (ranges.comments ?? []).slice()

  // Changes are assumed to be sorted, but not comments
  comments.sort((a, b) => a.op.p - b.op.p)

  /**
   * This will allow us to go through comments at a different pace as we loop
   * through tracked changes
   */
  const commentsIterator = new CommentsIterator(comments)

  /**
   * Current offset between editor pos and history pos
   */
  let offset = 0

  /**
   * History comments that might overlap with the tracked change considered
   *
   * @type {HistoryComment[]}
   */
  let pendingComments = []

  /**
   * The final history comments generated
   *
   * @type {HistoryComment[]}
   */
  const historyComments = []

  /**
   * The final history tracked changes generated
   *
   * @type {HistoryTrackedChange[]}
   */
  const historyChanges = []

  for (const change of changes) {
    historyChanges.push(toHistoryChange(change, offset))

    // After this point, we're only interested in tracked deletes
    if (!isDelete(change.op)) {
      continue
    }

    // Fill pendingComments with new comments that start before this tracked
    // delete and might overlap
    for (const comment of commentsIterator.nextComments(change.op.p)) {
      pendingComments.push(toHistoryComment(comment, offset))
    }

    // Save comments that are fully before this tracked delete
    const newPendingComments = []
    for (const historyComment of pendingComments) {
      const commentEnd = historyComment.op.p + historyComment.op.c.length
      if (commentEnd <= change.op.p) {
        historyComments.push(historyComment)
      } else {
        newPendingComments.push(historyComment)
      }
    }
    pendingComments = newPendingComments

    // The rest of pending comments overlap with this tracked change. Adjust
    // their history length.
    for (const historyComment of pendingComments) {
      historyComment.op.hlen =
        (historyComment.op.hlen ?? historyComment.op.c.length) +
        change.op.d.length
    }

    // Adjust the offset
    offset += change.op.d.length
  }
  // Save the last pending comments
  for (const historyComment of pendingComments) {
    historyComments.push(historyComment)
  }

  // Save any comments that came after the last tracked change
  for (const comment of commentsIterator.nextComments()) {
    historyComments.push(toHistoryComment(comment, offset))
  }

  const historyRanges = {}
  if (historyComments.length > 0) {
    historyRanges.comments = historyComments
  }
  if (historyChanges.length > 0) {
    historyRanges.changes = historyChanges
  }
  return historyRanges
}

class CommentsIterator {
  /**
   * Build a CommentsIterator
   *
   * @param {Comment[]} comments
   */
  constructor(comments) {
    this.comments = comments
    this.currentIndex = 0
  }

  /**
   * Generator that returns the next comments to consider
   *
   * @param {number} beforePos - only return comments that start before this position
   * @return {Iterable<Comment>}
   */
  *nextComments(beforePos = Infinity) {
    while (this.currentIndex < this.comments.length) {
      const comment = this.comments[this.currentIndex]
      if (comment.op.p < beforePos) {
        yield comment
        this.currentIndex += 1
      } else {
        return
      }
    }
  }
}

/**
 * Convert an editor tracked change into a history tracked change
 *
 * @param {TrackedChange} change
 * @param {number} offset - how much the history change is ahead of the
 *                 editor change
 * @return {HistoryTrackedChange}
 */
function toHistoryChange(change, offset) {
  /** @type {HistoryTrackedChange} */
  const historyChange = _.cloneDeep(change)
  if (offset > 0) {
    historyChange.op.hpos = change.op.p + offset
  }
  return historyChange
}

/**
 * Convert an editor comment into a history comment
 *
 * @param {Comment} comment
 * @param {number} offset - how much the history comment is ahead of the
 *                 editor comment
 * @return {HistoryComment}
 */
function toHistoryComment(comment, offset) {
  /** @type {HistoryComment} */
  const historyComment = _.cloneDeep(comment)
  if (offset > 0) {
    historyComment.op.hpos = comment.op.p + offset
  }
  return historyComment
}

module.exports = {
  toHistoryRanges,
}
