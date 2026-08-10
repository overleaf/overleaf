// @ts-check
'use strict'

const { z, zz } = require('@overleaf/validation-tools')

// Zod schemas for the sharejs-text-ot ranges data (RangesTracker format).
// The types in ./types.ts are inferred from these schemas.
//
// Ranges data is persisted round-trip (docstore <-> web <-> document-updater)
// without normalization, so legacy shapes survive on old documents and the
// schemas model them explicitly: comments/changes preloaded from web may lack `id`.
// Tightening these is tracked as part of moving the shared editor payload
// schemas into overleaf-editor-core.
//
// Old tracked changes created while the fixedRemoveChange flag existed
// (removed in https://github.com/overleaf/internal/pull/23993) still carry
// it in their op until accepted/rejected.

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
  c: z.string(),
  p: z.number().int().min(0),
  t: zz.objectId(),
  u: z.boolean().optional(),
  // Used by project-history when restoring CommentSnapshots
  resolved: z.boolean().optional(),
})

const rangeMetadata = z.strictObject({
  user_id: z.string(),
  ts: z.string(),
})

const comment = z.strictObject({
  id: zz.objectId().optional(),
  op: commentOp,
  metadata: rangeMetadata.optional(),
})

// tracked-change ids are RangesTracker ids (seed + increment), not ObjectIds
const trackedChange = z.strictObject({
  id: z.string().optional(),
  op: insertOp.or(deleteOp),
  metadata: rangeMetadata,
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
