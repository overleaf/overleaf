// @ts-check

import {
  Range,
  TrackedChange,
  TrackedChangeList,
  CommentList,
  Comment,
  TrackingProps,
} from 'overleaf-editor-core'
import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'

/**
 * @import { AddDocUpdate } from './types'
 * @import { CommentRawData, TrackedChangeRawData } from 'overleaf-editor-core/lib/types'
 */

/**
 *
 * @param {AddDocUpdate} update
 * @returns {{trackedChanges: TrackedChangeRawData[], comments: CommentRawData[]} | undefined}
 */
export function createRangeBlobDataFromUpdate(update) {
  logger.debug({ update }, 'createBlobDataFromUpdate')

  if (update.doc == null || update.docLines == null) {
    throw new OError('Not an AddFileUpdate')
  }
  if (
    !update.ranges ||
    (update.ranges.changes == null && update.ranges.comments == null)
  ) {
    return undefined
  }

  if (
    (!update.ranges.changes || update.ranges.changes.length === 0) &&
    (!update.ranges.comments || update.ranges.comments.length === 0)
  ) {
    return undefined
  }

  const sortedRanges = [...(update.ranges.changes || [])].sort((a, b) => {
    if (a.op.p !== b.op.p) {
      return a.op.p - b.op.p
    }
    if ('i' in a.op && a.op.i != null && 'd' in b.op && b.op.d != null) {
      // Move deletes before inserts
      return 1
    }
    return -1
  })

  const tcList = new TrackedChangeList([])

  for (const change of sortedRanges) {
    if ('d' in change.op && change.op.d != null) {
      const length = change.op.d.length
      const range = new Range(change.op.hpos ?? change.op.p, length)
      tcList.add(
        new TrackedChange(
          range,
          new TrackingProps(
            'delete',
            change.metadata.user_id,
            new Date(change.metadata.ts)
          )
        )
      )
    } else if ('i' in change.op && change.op.i != null) {
      const length = change.op.i.length
      const range = new Range(change.op.hpos ?? change.op.p, length)
      tcList.add(
        new TrackedChange(
          range,
          new TrackingProps(
            'insert',
            change.metadata.user_id,
            new Date(change.metadata.ts)
          )
        )
      )
    }
  }
  const comments = [...(update.ranges.comments || [])].sort((a, b) => {
    return a.op.p - b.op.p
  })

  /** @type {Map<string, {ranges: Range[], resolved: boolean}>} */
  const commentMap = new Map()
  for (const comment of comments) {
    const id = comment.op.t
    if (!commentMap.has(id)) {
      commentMap.set(id, {
        ranges: [],
        resolved: comment.op.resolved ?? false,
      })
    }
    const entry = commentMap.get(id)
    if (!entry) {
      throw new Error('Comment entry not found')
    }
    if (entry.resolved !== (comment.op.resolved ?? false)) {
      throw new Error('Mismatching resolved status for comment')
    }

    const commentLength = comment.op.c.length
    if (commentLength > 0) {
      // Empty comments in operations are translated to detached comments
      const range = new Range(comment.op.hpos ?? comment.op.p, commentLength)
      entry.ranges.push(range)
    }
  }
  const commentList = new CommentList(
    [...commentMap.entries()].map(
      ([id, commentObj]) =>
        new Comment(id, commentObj.ranges, commentObj.resolved)
    )
  )

  return { trackedChanges: tcList.toRaw(), comments: commentList.toRaw() }
}
