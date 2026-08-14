import { z, zz } from '@overleaf/validation-tools'
import { rawBlobHash } from 'overleaf-editor-core/lib/schemas.js'

// Mongo-linked or legacy v1 numeric project/history id (see
// project-history's app/js/HttpController.js for the same historyIdSchema
// pattern -- most history routes accept either a Mongo-linked or legacy v1
// numeric project id).
const historyIdSchema = zz.objectId().or(z.coerce.number())

// KeyBuilder's *FileKeyMiddleware functions are the sole consumers of
// req.params for their routes (FileController only ever reads the derived
// req.key/req.bucket set by these middlewares), so each gets a strict,
// route-owning schema rather than the permissive wrapper used by
// cross-cutting middleware.

// Note: this ":format" path param is unrelated to the "format"/"style"
// *query* params validated below (getFileQuerySchema) -- it's really a
// per-file identifier (an arbitrary id or filename) that becomes a storage
// key segment, matching how templates' own filestore Proxy.js validates the
// same value (forwarded verbatim) as "file_type".
export const templateFileParamsSchema = z.object({
  params: z.strictObject({
    template_id: zz.objectId(),
    version: z.coerce.number().int().nonnegative(),
    format: zz.filepath(),
    // present only on the .../v/:version/:format/:sub_type mount; this same
    // middleware is used for both routes
    sub_type: zz.filepath().optional(),
  }),
})

// Rollout-temporary fallback (loosened variant of templateFileParamsSchema:
// z.strictObject -> z.object, zz.objectId()/zz.filepath() -> z.string(),
// int()/nonnegative() refinements dropped, z.coerce.number() kept) for the
// REQ_VALIDATION_MODE log-only rollout; delete when this route's
// instrumentation is removed.
export const templateFileParamsFallbackSchema = z.object({
  params: z.object({
    template_id: z.string(),
    version: z.coerce.number(),
    format: z.string(),
    sub_type: z.string().optional(),
  }),
})

export const bucketFileParamsSchema = z.object({
  params: z.strictObject({
    bucket: z.string().regex(/^[a-z0-9-]+$/),
    key: zz.filepath(),
  }),
})

export const globalBlobFileParamsSchema = z.object({
  params: z.strictObject({
    hash: rawBlobHash,
  }),
})

export const projectBlobFileParamsSchema = z.object({
  params: z.strictObject({
    historyId: historyIdSchema,
    hash: rawBlobHash,
  }),
})

// Rollout-temporary fallback (loosened variant of projectBlobFileParamsSchema:
// z.strictObject -> z.object, zz.objectId()/regex refinements dropped from
// historyId/hash, z.coerce.number() kept in the historyId union) for the
// REQ_VALIDATION_MODE log-only rollout; delete when this route's
// instrumentation is removed.
export const projectBlobFileParamsFallbackSchema = z.object({
  params: z.object({
    historyId: z.string().or(z.coerce.number()),
    hash: z.string(),
  }),
})

// Shared across every getFile/getFileHead route regardless of which
// *FileKeyMiddleware ran first.
export const getFileQuerySchema = z.object({
  query: z.strictObject({
    // desired output conversion format/style (currently only 'png' /
    // 'thumbnail' / 'preview' are ever accepted downstream in
    // FileConverter.js and FileHandler.js -- left as a plain optional
    // string here since an unsupported value already yields a well-defined
    // ConversionError/500 today, and no existing test pins a 400 for this).
    format: z.string().optional(),
    style: z.string().optional(),
    cacheWarm: z.stringbool().optional(),
  }),
  headers: z.object({
    range: z.string().optional(),
  }),
})

// Rollout-temporary fallback (loosened variant of getFileQuerySchema:
// z.strictObject -> z.object, z.stringbool() kept since cacheWarm is used as
// a real boolean downstream -- a raw string like "false" would be truthy)
// for the REQ_VALIDATION_MODE log-only rollout; delete when this route's
// instrumentation is removed.
export const getFileQueryFallbackSchema = z.object({
  query: z.object({
    format: z.string().optional(),
    style: z.string().optional(),
    cacheWarm: z.stringbool().optional(),
  }),
  headers: z.object({
    range: z.string().optional(),
  }),
})
