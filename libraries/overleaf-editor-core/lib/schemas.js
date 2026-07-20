// @ts-check
'use strict'

const { z, zz } = require('@overleaf/validation-tools')

const rawTrackingProps = z.strictObject({
  type: z.enum(['insert', 'delete']),
  userId: zz.objectId(),
  ts: z.iso.datetime(),
})

const rawClearTrackingProps = z.strictObject({
  type: z.literal('none'),
})

const rawInsertOp = z.union([
  z.strictObject({
    i: z.string(),
    commentIds: z.array(zz.objectId()).optional(),
    tracking: rawTrackingProps.optional(),
  }),
  z.string(),
])

const rawRemoveOp = z.number().int().max(-1)

const rawRetainOp = z.union([
  z.strictObject({
    r: z.number().int().min(1),
    commentIds: z.array(zz.objectId()).optional(),
    tracking: rawTrackingProps.or(rawClearTrackingProps).optional(),
  }),
  z.number().int().min(1),
])

const rawScanOp = z.union([rawInsertOp, rawRemoveOp, rawRetainOp])

const rawTextOperation = z.strictObject({
  textOperation: z.array(rawScanOp).min(1),
  contentHash: z.string().optional(),
})

const rawRange = z.strictObject({
  pos: z.number().int().min(0),
  length: z.number().int().min(0),
})

const rawAddCommentOperation = z.strictObject({
  commentId: zz.objectId(),
  ranges: z.array(rawRange).min(1),
  resolved: z.boolean().optional(),
})

const rawSetCommentStateOperation = z.strictObject({
  commentId: zz.objectId(),
  resolved: z.boolean(),
})

const rawDeleteCommentOperation = z.strictObject({
  deleteComment: zz.objectId(),
})

const rawEditNoOperation = z.strictObject({
  noOp: z.literal(true),
})

const rawEditOperation = z.union([
  rawTextOperation,
  rawAddCommentOperation,
  rawDeleteCommentOperation,
  rawSetCommentStateOperation,
  rawEditNoOperation,
])

module.exports = {
  rawTrackingProps,
  rawClearTrackingProps,
  rawInsertOp,
  rawRemoveOp,
  rawRetainOp,
  rawScanOp,
  rawTextOperation,
  rawRange,
  rawAddCommentOperation,
  rawSetCommentStateOperation,
  rawDeleteCommentOperation,
  rawEditNoOperation,
  rawEditOperation,
}
