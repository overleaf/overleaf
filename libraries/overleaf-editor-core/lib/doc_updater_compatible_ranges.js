// @ts-check
'use strict'

/**
 * @import File from "./file"
 */

/**
 * Constructs tracked changes and comments in a document-updater compatible format.
 * Positions will be relative to a document where tracked deletes have been
 * removed from the string. This also means that if a tracked delete overlaps
 * a comment range, the comment range will be truncated.
 *
 * @param {File} file
 */
function getDocUpdaterCompatibleRanges(file) {
  if (!file.isEditable()) {
    // A binary file has no tracked changes or comments
    return {
      changes: [],
      comments: [],
    }
  }

  const content = file.getContent()
  if (content == null) {
    throw new Error('Unable to read file contents')
  }

  const trackedChanges = file.getTrackedChanges().asSorted()
  const comments = file.getComments().toArray()
  const docUpdaterCompatibleTrackedChanges = []

  let trackedDeletionOffset = 0
  for (const trackedChange of trackedChanges) {
    const isTrackedDeletion = trackedChange.tracking.type === 'delete'
    const trackedChangeContent = content.slice(
      trackedChange.range.start,
      trackedChange.range.end
    )
    const tcContent = isTrackedDeletion
      ? { d: trackedChangeContent }
      : { i: trackedChangeContent }
    docUpdaterCompatibleTrackedChanges.push({
      op: {
        p: trackedChange.range.start - trackedDeletionOffset,
        ...tcContent,
      },
      metadata: {
        ts: trackedChange.tracking.ts.toISOString(),
        user_id: trackedChange.tracking.userId,
      },
    })
    if (isTrackedDeletion) {
      trackedDeletionOffset += trackedChange.range.length
    }
  }

  //  Comments are shifted left by the length of any previous tracked deletions.
  //  If they  overlap with a tracked deletion, they are truncated.
  //
  // Example:
  //   { } comment
  //   [ ] tracked deletion
  //   the quic[k {b]rown [fox] jum[ps} ove]r the lazy dog
  //   => rown  jum
  //      starting at position 8
  const trackedDeletions = trackedChanges.filter(
    tc => tc.tracking.type === 'delete'
  )
  const docUpdaterCompatibleComments = []
  for (const comment of comments) {
    let trackedDeletionIndex = 0
    if (comment.ranges.length === 0) {
      // Translate detached comments into zero length comments at position 0
      docUpdaterCompatibleComments.push({
        op: {
          p: 0,
          c: '',
          t: comment.id,
          resolved: comment.resolved,
        },
      })
      continue
    }

    // Consider a multiple range comment as a single comment that joins all its
    // ranges
    const commentStart = comment.ranges[0].start
    const commentEnd = comment.ranges[comment.ranges.length - 1].end

    let commentContent = ''
    // Docupdater position
    let position = commentStart
    while (trackedDeletions[trackedDeletionIndex]?.range.end <= commentStart) {
      // Skip over tracked deletions that are before the current comment range
      position -= trackedDeletions[trackedDeletionIndex].range.length
      trackedDeletionIndex++
    }

    if (trackedDeletions[trackedDeletionIndex]?.range.start < commentStart) {
      // There's overlap with a tracked deletion, move the position left and
      // truncate the overlap
      position -=
        commentStart - trackedDeletions[trackedDeletionIndex].range.start
    }

    // Cursor in the history content
    let cursor = commentStart
    while (cursor < commentEnd) {
      const trackedDeletion = trackedDeletions[trackedDeletionIndex]
      if (!trackedDeletion || trackedDeletion.range.start >= commentEnd) {
        // We've run out of relevant tracked changes
        commentContent += content.slice(cursor, commentEnd)
        break
      }
      if (trackedDeletion.range.start > cursor) {
        // There's a gap between the current cursor and the tracked deletion
        commentContent += content.slice(cursor, trackedDeletion.range.start)
      }

      if (trackedDeletion.range.end <= commentEnd) {
        // Skip to the end of the tracked delete
        cursor = trackedDeletion.range.end
        trackedDeletionIndex++
      } else {
        // We're done with that comment
        break
      }
    }
    docUpdaterCompatibleComments.push({
      op: {
        p: position,
        c: commentContent,
        t: comment.id,
        resolved: comment.resolved,
      },
      id: comment.id,
    })
  }

  return {
    changes: docUpdaterCompatibleTrackedChanges,
    comments: docUpdaterCompatibleComments,
  }
}

module.exports = {
  getDocUpdaterCompatibleRanges,
}
