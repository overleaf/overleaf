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
    tracking: z
      .discriminatedUnion('type', [rawTrackingProps, rawClearTrackingProps])
      .optional(),
  }),
  z.number().int().min(1),
])

const rawScanOp = z.union([rawInsertOp, rawRemoveOp, rawRetainOp])

const rawTextOperation = z.strictObject({
  textOperation: z.array(rawScanOp),
  contentHash: z.string().optional(),
})

const rawRange = z.strictObject({
  pos: z.number().int().min(0),
  length: z.number().int().min(0),
})

const rawAddCommentOperation = z.strictObject({
  commentId: zz.objectId(),
  ranges: z.array(rawRange),
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

const rawComment = z.strictObject({
  id: zz.objectId(),
  ranges: z.array(rawRange),
  resolved: z.boolean().optional(),
})

const rawTrackedChange = z.strictObject({
  range: rawRange,
  tracking: rawTrackingProps,
})

const rawStringFileData = z.strictObject({
  content: z.string(),
  comments: z.array(rawComment).optional(),
  trackedChanges: z.array(rawTrackedChange).optional(),
})

// linkedFileData as written by the web linked-file agents (all-scalar; see
// the per-provider _sanitizeData implementations in web). importedAt is
// always written on create/refresh but may be absent on very old documents.
const rawLinkedFileData = z.discriminatedUnion('provider', [
  z.strictObject({
    provider: z.literal('url'),
    url: z.string(),
    importedAt: z.iso.datetime().optional(),
  }),
  z.strictObject({
    provider: z.literal('project_file'),
    source_project_id: zz.objectId().optional(),
    v1_source_doc_id: z.number().optional(),
    source_entity_path: z.string(),
    // written by the linked-file agents until 2018 (removed in ebe828aa625)
    // and never since; still present in the history of projects that linked a
    // file before then, so it has to be tolerated when replaying changes.
    source_project_display_name: z.string().optional(),
    importedAt: z.iso.datetime().optional(),
  }),
  z.strictObject({
    provider: z.literal('project_output_file'),
    source_project_id: zz.objectId().optional(),
    v1_source_doc_id: z.number().optional(),
    source_output_file_path: z.string(),
    build_id: zz.buildId().optional(),
    compileGroup: zz.compileGroup().optional(),
    clsiServerId: zz.clsiServerId().optional(),
    importedAt: z.iso.datetime().optional(),
  }),
  z.strictObject({
    provider: z.literal('mendeley'),
    // null, not just absent, for an import from a personal library: the web
    // agents always build the data object with a group_id key, so no group
    // means `group_id: undefined`, and mongoose keeps that key when $set-ing
    // the Mixed linkedFileData (upserting over an existing file), where the
    // driver serializes it as null. Same for the zotero/papers branches.
    group_id: zz.routeSegment().nullish(),
    importer_id: z.string().optional(),
    v1_importer_id: z.number().optional(),
    importedAt: z.iso.datetime().optional(),
  }),
  z.strictObject({
    provider: z.literal('zotero'),
    // absent on files imported before the `format` field existed; agents
    // default this to 'bibtex' (ZoteroAgent `_getFormat`)
    format: z.enum(['bibtex', 'biblatex']).optional(),
    group_id: zz.routeSegment().nullish(),
    importer_id: z.string().optional(),
    v1_importer_id: z.number().optional(),
    importedAt: z.iso.datetime().optional(),
  }),
  z.strictObject({
    provider: z.literal('papers'),
    group_id: zz.routeSegment().nullish(),
    importer_id: z.string().optional(),
    v1_importer_id: z.number().optional(),
    importedAt: z.iso.datetime().optional(),
  }),
])

const rawBlobHash = z.string().regex(/^[0-9a-f]{40}$/, {
  message: 'invalid blob hash',
})

const rawFileMetadata = z.union([
  // doc/clear metadata
  z.strictObject({}),
  // regular file v2
  z.strictObject({
    importedAt: z.iso.datetime(),
  }),
  // linked-file v2
  rawLinkedFileData,

  // main-file v1, and the doc flags the editor sets
  z.strictObject({
    main: z.boolean().optional(),
    mainBibliography: z.boolean().optional(),
    importedAt: z.iso.datetime().optional(),
  }),
  // legacy v1 linked file
  z.strictObject({
    agent: z.string(),
    agentDataId: z.number(),
    importedAt: z.iso.datetime().optional(),
  }),
])

const rawHashFileData = z.strictObject({
  hash: rawBlobHash,
  rangesHash: rawBlobHash.optional(),
})

const rawBinaryFileData = z.strictObject({
  hash: rawBlobHash,
  byteLength: z.number().int().min(0),
})

const rawLazyStringFileData = z.strictObject({
  hash: rawBlobHash,
  stringLength: z.number().int().min(0),
  rangesHash: rawBlobHash.optional(),
  operations: z.array(rawEditOperation).optional(),
})

const rawHollowBinaryFileData = z.strictObject({
  byteLength: z.number().int().min(0),
})

const rawHollowStringFileData = z.strictObject({
  stringLength: z.number().int().min(0),
})

const rawFileData = z.union([
  rawBinaryFileData,
  rawHashFileData,
  rawHollowBinaryFileData,
  rawHollowStringFileData,
  rawLazyStringFileData,
  rawStringFileData,
])

// the strict variants disambiguate the union by their key sets
const rawFile = z.union([
  rawBinaryFileData.extend({ metadata: rawFileMetadata.optional() }),
  rawHashFileData.extend({ metadata: rawFileMetadata.optional() }),
  rawHollowBinaryFileData.extend({ metadata: rawFileMetadata.optional() }),
  rawHollowStringFileData.extend({ metadata: rawFileMetadata.optional() }),
  rawLazyStringFileData.extend({ metadata: rawFileMetadata.optional() }),
  rawStringFileData.extend({ metadata: rawFileMetadata.optional() }),
])

const rawFileMap = z.record(z.string(), rawFile)

const rawV2DocVersions = z.record(
  z.string(),
  z.strictObject({
    pathname: z.string(),
    v: z.number().int(),
  })
)

const rawSnapshot = z.strictObject({
  files: rawFileMap,
  projectVersion: z.string().optional(),
  v2DocVersions: rawV2DocVersions.nullish(),
  timestamp: z.iso.datetime().optional(),
})

// mirrors Origin.fromRaw: three restore variants plus a generic kind
//
// Every variant may carry the id of the client that submitted the change, which
// is what lets history recognise a resend and the client recognise its own change
// coming back. It is optional throughout: most changes are ones nothing has to
// recognise again, and the id is dropped from the rest once they can no longer be
// resent, so a bare {kind} is the common shape.
const historyClientId = z.uuid().optional()

// The kinds that have a shape of their own, which the variants below describe. A
// payload claiming one of them has to match that shape rather than falling through
// to the catch-all, where it would validate as a kind and nothing else and then be
// read back as a change that has lost what the kind promised.
const namedOriginKinds = ['restore', 'file-restore', 'project-restore']

// The fields every origin has, which is also what an origin with nothing but a kind
// serialises to -- Origin's own raw form, and the union's catch-all below.
const rawBaseOrigin = z.strictObject({
  kind: z.string().refine(kind => !namedOriginKinds.includes(kind), {
    message: 'origin kind has a shape of its own',
  }),
  historyClientId,
})

const rawRestoreOrigin = z.strictObject({
  kind: z.literal('restore'),
  version: z.number().int(),
  timestamp: z.iso.datetime(),
  historyClientId,
})

const rawRestoreFileOrigin = z.strictObject({
  kind: z.literal('file-restore'),
  version: z.number().int(),
  path: z.string(),
  timestamp: z.iso.datetime(),
  historyClientId,
})

const rawRestoreProjectOrigin = z.strictObject({
  kind: z.literal('project-restore'),
  version: z.number().int(),
  timestamp: z.iso.datetime(),
  historyClientId,
})

// The named kinds discriminate on `kind`, so a payload claiming one of them is
// checked against that shape alone and the error says which field it got wrong. The
// catch-all cannot join them -- its kind is any string, which zod rejects as a
// discriminator -- so it sits alongside, and its refinement above is what stops it
// swallowing a named kind.
const rawOrigin = z.union([
  z.discriminatedUnion('kind', [
    rawRestoreOrigin,
    rawRestoreFileOrigin,
    rawRestoreProjectOrigin,
  ]),
  rawBaseOrigin,
])

// mirrors Operation.fromRaw: add file / edit file / move (or delete) file /
// set file metadata / no-op
const rawAddFileOperation = z.strictObject({
  pathname: z.string(),
  file: rawFile,
})

const rawMoveFileOperation = z.strictObject({
  pathname: z.string(),
  newPathname: z.string(),
})

const rawEditFileOperation = z.union([
  rawTextOperation.extend({ pathname: z.string() }),
  rawAddCommentOperation.extend({ pathname: z.string() }),
  rawDeleteCommentOperation.extend({ pathname: z.string() }),
  rawSetCommentStateOperation.extend({ pathname: z.string() }),
  rawEditNoOperation.extend({ pathname: z.string() }),
])

const rawSetFileMetadataOperation = z.strictObject({
  pathname: z.string(),
  metadata: rawFileMetadata,
})

const rawNoOperation = z.strictObject({})

const rawOperation = z.union([
  rawAddFileOperation,
  rawEditFileOperation,
  rawMoveFileOperation,
  rawSetFileMetadataOperation,
  rawNoOperation,
])

const rawChange = z.strictObject({
  operations: z.array(rawOperation),
  timestamp: z.iso.datetime(),
  // null represents an anonymous author
  authors: z.array(z.number().int().nullable()).optional(),
  v2Authors: z.array(zz.objectId().nullable()).optional(),
  origin: rawOrigin.optional(),
  projectVersion: z.string().optional(),
  v2DocVersions: rawV2DocVersions.optional(),
})

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
  rawComment,
  rawTrackedChange,
  rawStringFileData,
  rawLinkedFileData,
  rawBlobHash,
  rawFileMetadata,
  rawHashFileData,
  rawBinaryFileData,
  rawLazyStringFileData,
  rawHollowBinaryFileData,
  rawHollowStringFileData,
  rawFileData,
  rawFile,
  rawFileMap,
  rawV2DocVersions,
  rawSnapshot,
  rawBaseOrigin,
  rawRestoreOrigin,
  rawRestoreFileOrigin,
  rawRestoreProjectOrigin,
  rawOrigin,
  rawAddFileOperation,
  rawMoveFileOperation,
  rawEditFileOperation,
  rawSetFileMetadataOperation,
  rawNoOperation,
  rawOperation,
  rawChange,
}
