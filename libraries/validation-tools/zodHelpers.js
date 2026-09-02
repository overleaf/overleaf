const { z } = require('zod')
const mongodb = require('mongodb')

const { ObjectId } = mongodb

/**
 * @import { DatetimeSchemaOptions } from './types'
 */

/**
 * @param {DatetimeSchemaOptions} options
 */
const datetimeSchema = ({ allowNull, allowUndefined, ...zodOptions } = {}) => {
  const union = [z.date(), z.iso.datetime(zodOptions)]
  if (allowNull) union.push(z.null())
  if (allowUndefined) union.push(z.undefined())
  return z.union(union).transform(dt => {
    if (allowNull && !dt) return dt === null ? null : undefined
    return dt instanceof Date ? dt : new Date(dt)
  })
}

const zz = {
  /**
   * A field whose absence its source represents inconsistently: left out of
   * some records and null in others. JSON has no undefined, and Mongo stores a
   * $set of undefined as null, so an absent-ish field arrives as null about as
   * often as it is missing outright.
   *
   * Unlike z.optional(), which accepts only undefined, both forms are accepted
   * and normalised to undefined, so callers have a single absent value to
   * check rather than a `T | null | undefined` to narrow.
   *
   * The one combinator here: it wraps another schema instead of describing a
   * value type of its own.
   *
   * @template Output
   * @param {z.ZodType<Output>} schema
   */
  optional: schema => schema.nullish().transform(value => value ?? undefined),
  objectId: () =>
    z.string().refine(ObjectId.isValid, { message: 'invalid Mongo ObjectId' }),
  coercedObjectId: () =>
    z
      .string()
      .refine(ObjectId.isValid, { message: 'invalid Mongo ObjectId' })
      .transform(val => new ObjectId(val)),
  hex: () => z.string().regex(/^[0-9a-f]*$/),
  datetime: options => datetimeSchema(options),
  datetimeNullable: options => datetimeSchema({ ...options, allowNull: true }),
  datetimeNullish: options =>
    datetimeSchema({ ...options, allowNull: true, allowUndefined: true }),
  buildId: () =>
    z.string().regex(/^[0-9a-f]+-[0-9a-f]+$/, { message: 'invalid buildId' }),
  editorBuildId: () =>
    z.string().regex(/^[a-f0-9-]{36}-[0-9a-f]+-[0-9a-f]+$/, {
      message: 'invalid editorId-buildId',
    }),
  clsiServerId: () =>
    z.string().regex(/^[a-z0-9-]+$/, { message: 'invalid clsiServerId' }),
  compileBackendClass: () =>
    z
      .string()
      .regex(/^[a-z0-9-]+$/, { message: 'invalid compileBackendClass' }),
  compileGroup: () =>
    z.enum(['alpha', 'gvisor', 'standard', 'priority'], {
      message: 'invalid compileGroup',
    }),
  submissionId: () => z.string().regex(/^[a-zA-Z0-9_-]+$/),
  filepath: () =>
    z
      .string()
      .nonempty({ message: 'path is empty' })
      .refine(s => !s.startsWith('/'), { message: 'path is absolute' })
      .refine(s => !s.split('/').includes('..'), {
        message: 'path traversal detected',
      }),
  /**
   * A single opaque segment interpolated into a URL path for route/path
   * dispatch. Covers two shapes of the same sink: (1) internal re-dispatch
   * of the current request -- rewriting req.url before `next('route')`, or
   * a redirect Location -- and (2) a value forwarded, unescaped, into an
   * *outbound* URL built for a different service that does its own route
   * dispatch on it. Not a filesystem path, so filepath()'s "no leading /"
   * rule is too permissive (a bare `/` anywhere still splits the rebuilt
   * URL into extra segments) and its "no .. component" rule is too narrow
   * (query/fragment separators are just as dangerous here).
   */
  routeSegment: () =>
    z
      .string()
      .nonempty({ message: 'route segment is empty' })
      .refine(s => !/[/\\?#]/.test(s), {
        message: 'route segment contains a path, query or fragment separator',
      })
      .refine(s => s !== '.' && s !== '..', {
        message: 'route segment is a relative path component',
      }),
  /**
   * A project-internal document/file path (e.g. document-updater's
   * pathname/newPathname, or a resync's docs[]/files[] path) -- these are
   * root-relative ("/main.tex") in production (see web's
   * ProjectEntityHandler.getAllEntitiesFromProject, which path.join()s from
   * '/'), so unlike filepath() a leading "/" is allowed here, not rejected.
   * Mirrors web's app/src/Features/Project/SafePath.mjs (BADCHAR_RX,
   * BADFILE_RX, and BLOCKEDFILE_RX), which every path in a project's file
   * tree is already validated against at the point of origin -- this
   * closes the gap for services that receive that path secondhand (e.g.
   * forwarded into history-v1's archive/zip builder). Parity with
   * isCleanPath is asserted in web's SafePath.test.mjs, which imports
   * zz.safePath() and checks it against every isCleanPath test case; the
   * only remaining difference from that reference is deliberate: BADCHAR_RX's
   * leading "/" is not ported here, since "/" is the segment separator,
   * not a disallowed character, so a traversal payload is still caught
   * (as "." or "..") per split segment below, just not via this character
   * check. The unsafe-property-name check (BLOCKEDFILE_RX) matches
   * isCleanPath exactly -- only the top-level path, not nested segments --
   * since web already allows a reserved name below the top level (e.g. a
   * folder literally named "prototype" is permitted), and this schema
   * shouldn't reject paths web itself considers valid.
   */
  safePath: () => {
    // eslint-disable-next-line no-control-regex
    const BAD_CHAR_RX = /[\\*\x00-\x1f\x7f\x80-\x9f\uD800-\uDFFF]/
    const BAD_SEGMENT_RX = /^\.$|^\s|\s$/
    const UNSAFE_SEGMENT_RX =
      /^(prototype|constructor|toString|toLocaleString|valueOf|hasOwnProperty|isPrototypeOf|propertyIsEnumerable|__defineGetter__|__lookupGetter__|__defineSetter__|__lookupSetter__|__proto__)$/
    return z
      .string()
      .nonempty({ message: 'path is empty' })
      .refine(s => !s.endsWith('/'), {
        message: 'path is a folder, not a file',
      })
      .refine(s => !s.split('/').includes('..'), {
        message: 'path traversal detected',
      })
      .refine(s => !s.split('/').some(seg => BAD_SEGMENT_RX.test(seg)), {
        message: 'path segment is "." or has leading/trailing whitespace',
      })
      .refine(s => !BAD_CHAR_RX.test(s), {
        message: 'path contains a disallowed character',
      })
      .refine(s => !UNSAFE_SEGMENT_RX.test(s.replace(/^\//, '')), {
        message: 'path is an unsafe property name',
      })
  },
  /**
   * A history-v1 project id: either a 24-hex Mongo ObjectId or a Postgres
   * integer id, per history-v1's storage/lib/assert.js projectId().
   * Validating this at the schema boundary (not just deep in BlobStore's
   * constructor) means a malformed id 404s at the route instead of
   * depending on every call path remembering to construct a BlobStore (or
   * equivalent) first.
   */
  projectHistoryId: () =>
    z.string().regex(/^([0-9a-f]{24}|[1-9][0-9]{0,9})$/, {
      message: 'invalid project history id',
    }),
  /**
   * A history-v1 chunk id: either a 24-hex Mongo ObjectId or a Postgres
   * integer id, per history-v1's storage/lib/assert.js chunkId(). Validating
   * this at the schema boundary (not just deep in BlobStore's constructor)
   * means a malformed id 404s at the route instead of depending on every
   * call path remembering to construct a BlobStore (or equivalent) first.
   */
  chunkId: () =>
    z.string().regex(/^([0-9a-f]{24}|[1-9][0-9]{0,9})$/, {
      message: 'invalid chunk id',
    }),
  /**
   * A split test's name, per the frontend's yup schema in split-test/
   * frontend/js/features/components/split-test-create.jsx (mirrored in
   * split-test-edit.tsx): kebab-case, at least 3 characters long. Enforcing
   * this at the schema boundary matters beyond cosmetics: a split test name
   * is used as a dynamic property key (e.g.
   * SplitTestHandler.setOverrideInSession's
   * `session.splitTestOverrides[splitTestName] = ...` on a plain object), so
   * restricting the charset to [a-z0-9-] also rules out
   * __proto__/constructor/prototype and any path-traversal shape.
   */
  splitTestName: () =>
    z
      .string()
      .regex(/^[a-z0-9-]+$/, {
        message: 'split test name must be kebab-case',
      })
      .min(3, {
        message: 'split test name must be at least 3 characters long',
      }),
  /**
   * A split test variant's name, per the frontend's yup schema in
   * split-test/frontend/js/features/components/split-test-create.jsx
   * (mirrored in split-test-edit.tsx): kebab-case, at least 3 characters
   * long. Same underlying rule as zz.splitTestName() (and the same rationale
   * for enforcing it), just a semantically distinct field.
   */
  variantName: () =>
    z
      .string()
      .regex(/^[a-z0-9-]+$/, { message: 'variant name must be kebab-case' })
      .min(3, { message: 'variant name must be at least 3 characters long' }),
  /**
   * An analytics event name (e.g. AnalyticsController.mjs's recordEvent
   * param, or AnalyticsManager.recordEventForSession/recordEventForUser's
   * `event` argument in web), forwarded as-is from web's AnalyticsManager,
   * through the analytics service's events queue, to each downstream sink
   * (Mixpanel, Customer.io, Postgres, BigQuery). The charset isn't an
   * arbitrary narrowing: every event name a real user can trigger is one of
   * the small set of literal strings the frontend/backend code emits (never
   * user-supplied text), and every one of those literals -- across every
   * call site of recordEventForSession/recordEventForUser/
   * recordEventForMongoUser in web's app/, modules/ and scripts/ -- is
   * already kebab-case or snake_case, i.e. already matches
   * `/^[a-z0-9-_]+$/i`. Capped at 240 characters, well above the longest of
   * those literals. AnalyticsManager's own _isAttributeValid applies a
   * wider regex, but that's a separate, looser backend-only guard for call
   * sites that don't go through one of these schemas -- not evidence that a
   * wider charset is actually needed here.
   */
  eventName: () =>
    z
      .string()
      .min(1, { message: 'invalid event name' })
      .regex(/^[a-zA-Z0-9-_]+$/, { message: 'invalid event name' })
      .max(240, { message: 'event name is too long' }),
  /**
   * A multer file object (disk storage — the only storage backend we use),
   * for validating req.file / req.files on multipart routes. The
   * client-supplied originalname is held to the same traversal rules as
   * zz.filepath().
   */
  uploadedFile: () =>
    z.strictObject({
      fieldname: z.string(),
      originalname: zz.filepath(),
      encoding: z.string().optional(),
      mimetype: z.string(),
      size: z.number().int().nonnegative(),
      destination: z.string(),
      filename: z.string(),
      path: z.string(),
    }),
}

module.exports = { zz }
