// @ts-check
'use strict'

const { z, zz } = require('@overleaf/validation-tools')

// Zod schemas for the ranges data (RangesTracker format) accepted by
// updateDoc.
//
// Ranges reach docstore via web from several writers and are stored (and
// later round-tripped, e.g. by project clone) without normalization, so the
// schemas model wire reality rather than the ideal shape:
// - document-updater flushes RangesTracker data: a comment's id is its thread
//   id (docstore's RangeManager keeps the two in sync) and a tracked change's
//   id is a RangesTracker id, i.e. an 18 character seed plus a 6 character
//   increment, see libraries/ranges-tracker/index.cjs
// - history restores send id-less changes and comment ops with a `resolved`
//   flag (stripped again by RangeManager), and detached comments (a zero
//   length comment range at position 0), see
//   overleaf-editor-core/lib/doc_updater_compatible_ranges.js
// - old tracked changes created while the fixedRemoveChange flag existed
//   (removed in https://github.com/overleaf/internal/pull/23993) still carry
//   it in their op until accepted/rejected
// - old tracked changes created while the orderedRejections flag existed
//   (added in https://github.com/overleaf/internal/pull/22650) still carry
//   it in their op until accepted/rejected.

const insertOp = z.strictObject({
  i: z.string(),
  p: z.number().int().min(0),
  u: z.boolean().optional(),
  fixedRemoveChange: z.boolean().optional(),
  orderedRejections: z.boolean().optional(),
})

const deleteOp = z.strictObject({
  d: z.string(),
  p: z.number().int().min(0),
  u: z.boolean().optional(),
  fixedRemoveChange: z.boolean().optional(),
  orderedRejections: z.boolean().optional(),
})

const commentOp = z.strictObject({
  c: z.string(),
  p: z.number().int().min(0),
  t: zz.objectId(),
  u: z.boolean().optional(),
  // sent by history restores; removed again by RangeManager
  resolved: z.boolean().optional(),
})

const commentMetadata = z.strictObject({
  user_id: z.string().optional(),
  ts: z.string().optional(),
})

// tracked changes always carry the author and the time of the edit: both
// RangesTracker and history restores set them when creating the change
const trackedChangeMetadata = z.strictObject({
  user_id: z.string(),
  ts: z.string(),
})

const comment = z.strictObject({
  id: z.string().optional(),
  op: commentOp,
  metadata: commentMetadata.optional(),
})

const trackedChange = z.strictObject({
  id: z.string().optional(),
  op: insertOp.or(deleteOp),
  metadata: trackedChangeMetadata,
})

const ranges = z.strictObject({
  comments: z.array(comment).optional(),
  changes: z.array(trackedChange).optional(),
})

module.exports = {
  insertOp,
  deleteOp,
  commentOp,
  comment,
  trackedChange,
  ranges,
}
