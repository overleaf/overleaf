// @ts-check
import { z } from '@overleaf/validation-tools'

// Zod schemas for the ranges data (RangesTracker format) accepted by
// updateDoc.
//
// Ranges reach docstore via web from several writers and are stored (and
// later round-tripped, e.g. by project clone) without normalization, so the
// schemas model wire reality rather than the ideal shape:
// - document-updater flushes RangesTracker data: change/comment ids are
//   RangesTracker ids (seed + increment) or thread ids, i.e. strings that are
//   not always ObjectIds (and old fixtures/documents carry arbitrary string
//   thread ids), see libraries/ranges-tracker/index.cjs
// - history restores send id-less changes and comment ops with a `resolved`
//   flag (stripped again by RangeManager), and detached comments without an
//   id, see overleaf-editor-core/lib/doc_updater_compatible_ranges.js
// - old tracked changes created while the fixedRemoveChange flag existed
//   (removed in https://github.com/overleaf/internal/pull/23993) still carry
//   it in their op until accepted/rejected

const insertOp = z.strictObject({
  i: z.string(),
  p: z.number().int().min(0),
  u: z.boolean().optional(),
  fixedRemoveChange: z.boolean().optional(),
})

const deleteOp = z.strictObject({
  d: z.string(),
  p: z.number().int().min(0),
  u: z.boolean().optional(),
  fixedRemoveChange: z.boolean().optional(),
})

const commentOp = z.strictObject({
  c: z.string().optional(),
  p: z.number().int().min(0).optional(),
  // comment thread ids are usually ObjectIds, but legacy documents carry
  // arbitrary strings
  t: z.string().optional(),
  u: z.boolean().optional(),
  // sent by history restores; removed again by RangeManager
  resolved: z.boolean().optional(),
})

const rangeMetadata = z.strictObject({
  user_id: z.string().optional(),
  ts: z.string().optional(),
})

const comment = z.strictObject({
  id: z.string().optional(),
  op: commentOp,
  metadata: rangeMetadata.optional(),
})

const trackedChange = z.strictObject({
  id: z.string().optional(),
  op: insertOp.or(deleteOp).optional(),
  metadata: rangeMetadata.optional(),
})

export const ranges = z.strictObject({
  comments: z.array(comment).optional(),
  changes: z.array(trackedChange).optional(),
})
