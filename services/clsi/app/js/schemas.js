// @ts-check
// Zod schemas for the CLSI compile request body (the `{ compile: {...} }`
// payload posted to /project/:project_id/compile and to
// /project/:project_id/user/:user_id/download/project-to-document, which
// re-parses the same payload via RequestParser for document conversions).
//
// RequestParser.parse() (see ./RequestParser.js) already performs the deep,
// well-tested semantic validation of this payload: enum/valid-value checks
// (compiler, imageName against the configured allowlist, syncType),
// regex checks (historyId, editorId, buildId), timeout clamping, and the
// rootResourcePath/filestoreBlobPrefix traversal check. Its behaviour
// (including the specific error messages and the fact that a validation
// failure currently surfaces as a 500, e.g. AllowedImageNamesTests.js) is
// relied upon by both unit and acceptance tests, so this schema deliberately
// only models the wire *shape* (fields and their JS/JSON types) and leaves
// that semantic validation in place downstream, unchanged. The exception is
// rootResourcePath, which is also given the standard zz.filepath() traversal
// check here: it is a genuine path-traversal risk, the tightening is
// consistent with RequestParser's own _checkPath, and no test relies on the
// previous (500-producing) behaviour for a bad rootResourcePath.
//
// `token` (present in an old RequestParser unit-test fixture but never read
// by RequestParser, CompileManager or any known caller in this repo) is
// intentionally not part of the schema: every request field is expected to
// be modeled, and nothing sends or reads this one.
import { z, zz } from '@overleaf/validation-tools'
import editorCoreSchemas from 'overleaf-editor-core/lib/schemas.js'

// Kept in sync explicitly with RequestParser's VALID_COMPILERS: importing it
// from there isn't viable, as many unit tests mock the RequestParser module
// down to an empty object, and this schema module is loaded transitively
// through those mocks.
const VALID_COMPILERS = ['pdflatex', 'latex', 'xelatex', 'lualatex']

// Kept in sync explicitly with services/clsi-perf/app/js/Variants.js's
// setup(), which derives one variant per services/clsi-perf/app/js/variants/
// directory (currently example-project-frog, jpeg-images, memoir-manual,
// minimal), plus a `${name}-gvisor` variant for the special-cased "minimal"
// entry. HistoryResourceWriter.js's BlobStore#getBlobURL interpolates this
// straight into a URL pathname (`u.pathname =
// \`/variant/${clsiPerfVariant}/hash/${hash}\``), which -- unlike a template
// literal appended to an existing path -- re-resolves ".." segments against
// it, so an arbitrary string here is a real route/path dispatch confusion
// risk, not just a cosmetic one.
const VALID_CLSI_PERF_VARIANTS = [
  'example-project-frog',
  'jpeg-images',
  'memoir-manual',
  'minimal',
  'minimal-gvisor',
]

// historyId is Mongo-or-numeric: a Mongo ObjectId (SaaS) or a small
// Postgres-style integer id sent and kept as a string (Server Pro/CE). This
// is exactly RequestParser's own HISTORY_ID_REGEX
// (/^([0-9a-f]{24}|[1-9][0-9]{0,9})$/), which zz.projectHistoryId()
// also models (shared with history-v1); web sends it as
// options.historyId?.toString() either way, so it is never a JSON number.
const historyIdSchema = zz.projectHistoryId()

const compileOptionsSchema = z.strictObject({
  metricsPath: z.string().optional(),
  metricsMethod: z.string().optional(),
  compiler: z.enum(VALID_COMPILERS).optional(),
  compileFromClsiCache: z.boolean().optional(),
  populateClsiCache: z.boolean().optional(),
  enablePdfCaching: z.boolean().optional(),
  pdfCachingMinChunkSize: z.number().optional(),
  enableCheckpoint: z.boolean().optional(),
  timeout: z.number().optional(),
  // Unlike compiler/buildId/editorId/historyId, imageName has no fixed
  // vocabulary: it is checked against settings.clsi.docker.allowedImages,
  // a deployment-specific allowlist (see CompileManager._isImageNameAllowed
  // for the equivalent check on the sync/wordcount routes below). Modeling
  // it as an enum would hard-code one deployment's image list into the
  // schema itself.
  imageName: z.string().optional(),
  draft: z.boolean().optional(),
  png2pdf: z.boolean().optional(),
  stopOnFirstError: z.boolean().optional(),
  check: z.string().optional(),
  // wire reality: web (ClsiManager.mjs) always sends an array of flag
  // strings; RequestParser's own check merely requires typeof === 'object'.
  flags: z.array(z.string()).optional(),
  compileGroup: zz.compileGroup().optional(),
  syncType: z.string().optional(),
  syncState: z.string().optional(),
  historyId: historyIdSchema.optional(),
  editorId: z.uuid().optional(),
  buildId: zz.buildId().optional(),
  clsiPerfVariant: z.enum(VALID_CLSI_PERF_VARIANTS).optional(),
})

const resourceSchema = z.strictObject({
  path: zz.filepath(),
  // The only real caller, web's ClsiManager.mjs, sends `modified` as
  // `file.created?.getTime()` — an epoch-millisecond number, never an ISO
  // string.
  modified: z.number().optional(),
  url: z.url().optional(),
  fallbackURL: z.url().optional(),
  content: z.string().optional(),
})

const compileRequestSchema = z.strictObject({
  options: compileOptionsSchema.optional(),
  resources: z.array(resourceSchema).optional(),
  rootResourcePath: zz.filepath().optional(),
  baseHistoryVersion: z.number().optional(),
  // Validated when loading them in editor-core (Snapshot.fromRaw /
  // Change.mustFromRaw); reuse its schemas rather than approximate the shape
  // locally. rawChangeOperations is RawOperation[][]: one operations array
  // per history change, combined with a synthetic timestamp by
  // HistoryResourceWriter.changesFromRawChangeOperations.
  rawSnapshot: editorCoreSchemas.rawSnapshot.optional(),
  rawChangeOperations: z
    .array(z.array(editorCoreSchemas.rawOperation))
    .optional(),
  globalBlobs: z.array(editorCoreSchemas.rawBlobHash).optional(),
  // v1 conversions/submissions; spliced into a filestore URL downstream, so
  // it is held to the same traversal rules as rootResourcePath.
  filestoreBlobPrefix: zz.filepath().optional(),
})

export const compileRequestBodySchema = z.strictObject({
  compile: compileRequestSchema,
})
