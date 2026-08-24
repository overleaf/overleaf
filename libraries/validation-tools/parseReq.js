// @ts-check
const { InvalidRequestError, InvalidParamsError } = require('./Errors')
const {
  RAW_BODY,
  RAW_QUERY,
  RAW_PARAMS,
  isLockdownInstalled,
} = require('./lockdown')

/**
 * @typedef {import('zod').ZodType} ZodType
 * @typedef {import('zod').ZodError} ZodError
 * @typedef {import('zod').ZodIssue} ZodIssue
 * @typedef {import('express').Request} Request
 */

/**
 * @template T
 * @typedef {import('zod').output<T>} output<T>
 */

/**
 * Rollout options for parseReq(), see REQ_VALIDATION_MODE below. Passing opts
 * marks a call site as instrumented: in REQ_VALIDATION_MODE=log they change
 * what a schema failure does, in REQ_VALIDATION_MODE=enforce-log they only
 * add the failure log, and in REQ_VALIDATION_MODE=enforce they are inert.
 *
 * @typedef {object} ParseReqOptions
 * @property {boolean} [logOnly] - In REQ_VALIDATION_MODE=log, a primary
 *   schema failure (with no passing fallbackSchema) logs once and returns
 *   the raw, un-coerced request input instead of throwing. It never
 *   suppresses the throw in enforce-log mode.
 * @property {ZodType} [fallbackSchema] - In REQ_VALIDATION_MODE=log, a
 *   primary schema failure is re-parsed against this looser/pre-refinement
 *   schema. If it passes, its output is returned (and the primary schema's
 *   issues are logged). If it also fails, behavior falls back to logOnly
 *   above, classifying/throwing from the fallback's ZodError when logOnly
 *   is not set. In enforce-log mode it never changes the outcome (the
 *   request is rejected either way) and is only re-parsed to tag the log
 *   entry with whether the looser schema would have accepted the request.
 * @property {string[]} [logFields] - Dotted field paths (e.g. 'body.zipUrl')
 *   whose raw input values are resolved and included in the schema-failure
 *   log entry. Values are only resolved on failure; strings are truncated
 *   to 200 chars.
 */

/**
 * The request to validate. With the request-input lockdown installed
 * (REQ_LOCKDOWN_MODE=warn|throw), reading the public req.body / req.query /
 * req.params would warn or throw, so shadow them with the raw symbol-keyed
 * fields captured by the patched express. Every other field a schema may
 * reference (headers, file, files, ...) falls through to the request via the
 * prototype chain. Without the lockdown the request is passed through
 * unchanged.
 *
 * @param {Request} req
 * @returns {Request}
 */
function schemaInput(req) {
  if (!isLockdownInstalled(req)) return req
  return Object.create(req, {
    // @ts-ignore symbol-keyed fields added by the express patch
    params: { value: req[RAW_PARAMS], enumerable: true },
    // @ts-ignore
    query: { value: req[RAW_QUERY], enumerable: true },
    // @ts-ignore
    body: { value: req[RAW_BODY], enumerable: true },
  })
}

/*
 * Rollout mode for parseReq's schema-failure instrumentation, controlled by
 * the REQ_VALIDATION_MODE env var. Default (unset or any invalid value) is
 * 'log' -- deliberately not coupled to NODE_ENV, nothing automatic.
 *
 *  - 'log': a schema failure at an instrumented call site (one that passes
 *    opts) logs instead of throwing, see parseReq() below. Call sites that
 *    don't pass opts are unaffected and always throw.
 *  - 'enforce-log': throw+log. Failures are rejected exactly as in 'enforce'
 *    -- opts change nothing about the outcome -- but an instrumented call
 *    site logs the failure first, so the visibility built for the 'log'
 *    rollout (sanitized issues, caller trace, opts.logFields values, deduped
 *    per schema and signature) survives the move out of 'log' mode. This is
 *    the mode to move a service to once its schemas look clean in 'log'
 *    mode, and to stay in while the instrumentation is still in the code.
 *  - 'enforce': opts are inert, every call site always throws on failure,
 *    exactly as if parseReq() had no third parameter at all.
 */

/**
 * @typedef {'log' | 'enforce-log' | 'enforce'} ReqValidationMode
 */

/**
 * @param {string | null | undefined} m
 * @returns {m is ReqValidationMode}
 */
function isValidReqValidationMode(m) {
  return m === 'log' || m === 'enforce-log' || m === 'enforce'
}

/** @type {ReqValidationMode | null} */
let cachedMode = null

/**
 * @returns {ReqValidationMode}
 */
function mode() {
  if (cachedMode == null) {
    const m = process.env.REQ_VALIDATION_MODE
    cachedMode = isValidReqValidationMode(m) ? m : 'log'
  }
  return cachedMode
}

/**
 * Override the mode for tests. Pass null to clear the cache and force a
 * re-read of REQ_VALIDATION_MODE on the next access; pass 'log'/'enforce-log'
 * /'enforce'/anything else to force that value (coerced the same way mode()
 * would).
 *
 * Exported from index.js -- unlike testUtils.js's stateless assertion
 * helpers, this mutates module state that must be visible to the exact
 * parseReq() the app calls into, so tests need to reach it through the same
 * bare package specifier as app code (@overleaf/validation-tools), not a
 * direct subpath import. Under this repo's Yarn PnP + Vite/Vitest setup, a
 * subpath import (@overleaf/validation-tools/parseReq.js) can load this file
 * into a second, separate module instance with its own `cachedMode`, so a
 * test's setReqValidationModeForTests() call would silently miss the copy
 * the code under test actually calls into.
 *
 * @param {string | null} m
 */
function setReqValidationModeForTests(m) {
  if (m === null) {
    cachedMode = null
  } else {
    cachedMode = isValidReqValidationMode(m) ? m : 'log'
  }
}

/** @type {{ warn: (ctx: object, msg: string) => void } | undefined} */
let logger

/**
 * Inject the logger used by parseReq's log-only rollout mode. Called once
 * from @overleaf/logger's LoggingManager.initialize() at service boot (the
 * same injection pattern as @overleaf/fetch-utils' setLogger) -- validation
 * -tools cannot depend on @overleaf/logger directly, since logger's request
 * serializer already depends on validation-tools (getRawReqInput), and a
 * static import the other way would be a cycle. Logging is a silent no-op
 * until a logger has been injected.
 *
 * @param {{ warn: (ctx: object, msg: string) => void }} loggerInstance
 */
function setLogger(loggerInstance) {
  logger = loggerInstance
}

/**
 * Per-schema dedup: the *primary* zod schema object maps to the set of
 * (kind, sanitized issues) signatures already logged for it. A `let`, not a
 * `const`, so resetReqValidationLoggingForTests() can simply reassign it.
 * Kept per-schema (not global) so that two different routes/schemas that
 * happen to produce identical issues both get logged.
 *
 * @type {WeakMap<object, Set<string>>}
 */
let loggedSignatures = new WeakMap()

// Memory bound against pathological cardinality (e.g. an attacker choosing
// record keys that end up in issue paths, generating unbounded distinct
// signatures) -- once a schema's set hits this cap, stop adding/logging new
// signatures for that schema; already-logged ones keep deduping normally.
const MAX_SIGNATURES_PER_SCHEMA = 1000

/**
 * Reset the log-only rollout's dedup state between tests.
 */
function resetReqValidationLoggingForTests() {
  loggedSignatures = new WeakMap()
}

/**
 * Sanitize zod issues for logging: never include user-supplied values, only
 * shape/metadata that helps fix schemas (error code, path, message, and --
 * for unrecognized_keys -- the offending key names, which zod formats into
 * the message text). Never reads issue.input/values/params, and parseReq
 * never passes { reportInput: true } to safeParse, so zod v4 already omits
 * raw input from issues by default.
 *
 * @param {readonly ZodIssue[]} issues
 * @param {number} [depth]
 * @returns {Array<{ code: string | undefined, path: string, message: string, errors?: unknown }>}
 */
function sanitizeIssues(issues, depth = 0) {
  return issues.map(issue => {
    /** @type {{ code: string | undefined, path: string, message: string, errors?: unknown }} */
    const sanitized = {
      code: issue.code,
      path: issue.path.map(seg => String(seg).slice(0, 64)).join('.'),
      message: String(issue.message).slice(0, 200),
    }
    // Bounded by schema shape, not user input: each level corresponds to one
    // more union nested inside a union member (e.g. rawOperation -> rawFile
    // -> rawFileMetadata -> the linked-file provider discriminatedUnion), so
    // raising this cannot be exploited to grow log volume from adversarial
    // input the way an unbounded path/array traversal could.
    if (issue.code === 'invalid_union' && depth < 5) {
      sanitized.errors = issue.errors.map(nested =>
        sanitizeIssues(nested, depth + 1)
      )
    }
    return sanitized
  })
}

/**
 * What happened to the request the log entry describes: the first two kinds
 * are the 'log' mode outcomes (the request was let through), the last two the
 * 'enforce-log' ones (the request was rejected, and 'enforced-fallback-
 * passed' marks a rejection the looser fallbackSchema would have avoided --
 * i.e. one the tightened schema newly introduces, the interesting signal).
 *
 * @typedef {'log-only' | 'fallback-passed' | 'enforced' | 'enforced-fallback-passed'} LogKind
 */

/**
 * The log message per kind. The 'log' rollout's wording is kept verbatim for
 * its two kinds so existing log queries keep matching, with a distinct
 * message for the throw+log kinds; the `kind` field separates all four.
 *
 * @type {Record<LogKind, string>}
 */
const LOG_MESSAGES = {
  'log-only': 'req-validation: request failed schema in log-only rollout',
  'fallback-passed':
    'req-validation: request failed schema in log-only rollout',
  enforced: 'req-validation: request failed schema and was rejected',
  'enforced-fallback-passed':
    'req-validation: request failed schema and was rejected',
}

/**
 * Log a schema failure once per unique (kind, sanitized issues) signature
 * for the given primary schema. No-op if no logger has been injected.
 *
 * @param {Request} req
 * @param {ZodType} schema - the primary schema; the dedup key.
 * @param {LogKind} kind
 * @param {readonly ZodIssue[]} issues
 * @param {Request} input - the (possibly lockdown-unwrapped) request input
 * @param {string[]} [logFields] - dotted paths to resolve from input
 */
function logSchemaFailure(req, schema, kind, issues, input, logFields) {
  if (!logger) return

  const sanitizedIssues = sanitizeIssues(issues)
  const signature = JSON.stringify([kind, sanitizedIssues])

  let signatures = loggedSignatures.get(schema)
  if (!signatures) {
    signatures = new Set()
    loggedSignatures.set(schema, signatures)
  }
  if (signatures.has(signature)) return
  if (signatures.size >= MAX_SIGNATURES_PER_SCHEMA) return
  signatures.add(signature)

  // Deliberately not falling back to req.originalUrl/req.url -- those are
  // user-controlled and would leak into logs; unmatched routes just get
  // 'unknown' for the route part.
  const location = `${req.method} ${req.route?.path || 'unknown'}`
  const caller = /** @type {Error} */ (new Error('trace')).stack
    ?.split('\n')
    .slice(2, 7)
    .join('\n')

  /** @type {Record<string, unknown> | undefined} */
  let resolvedFields
  if (logFields) {
    resolvedFields = {}
    for (const field of logFields) {
      let val = /** @type {any} */ (input)
      for (const seg of field.split('.')) {
        if (val == null || typeof val !== 'object') {
          val = '<missing>'
          break
        }
        val = val[seg]
      }
      resolvedFields[field] = typeof val === 'string' ? val.slice(0, 200) : val
    }
  }

  logger.warn(
    {
      location,
      kind,
      issues: sanitizedIssues,
      caller,
      req,
      ...(resolvedFields && { failingValues: resolvedFields }),
    },
    LOG_MESSAGES[kind]
  )
}

/**
 * Classify a ZodError and throw the appropriate error: any issue rooted at
 * "params" means part of the URL path failed to validate, so the request
 * should 404 rather than 400.
 *
 * @param {ZodError} error
 * @returns {never}
 */
function throwClassified(error) {
  if (error.issues.some(issue => issue.path[0] === 'params')) {
    throw new InvalidParamsError(error)
  } else {
    throw new InvalidRequestError(error)
  }
}

/**
 * Parse and validate a request against a Zod schema.
 *
 * @template {ZodType} T
 * @param {Request} req - The Express request object
 * @param {T} schema - The Zod schema to validate against
 * @param {ParseReqOptions} [opts] - Rollout options. Untouched call sites
 *   that omit opts always enforce (throw on failure) and log nothing, in
 *   every mode -- opts change the outcome only when REQ_VALIDATION_MODE=log,
 *   and only add the failure log when REQ_VALIDATION_MODE=enforce-log.
 * @returns {output<T>} The validated request object. Note: in
 *   REQ_VALIDATION_MODE=log, a failing parse at an instrumented call site
 *   (opts set) does not necessarily produce T -- it may instead return
 *   opts.fallbackSchema's output, or the raw, un-coerced request input, per
 *   the opts handling documented above. In enforce-log and enforce mode a
 *   failing parse always throws, so the return value really is T.
 */
function parseReq(req, schema, opts) {
  const input = schemaInput(req)
  const parsed = schema.safeParse(input)
  if (parsed.success) {
    return parsed.data
  }

  if (opts && mode() === 'log') {
    if (opts.fallbackSchema) {
      const fallbackParsed = opts.fallbackSchema.safeParse(input)
      if (fallbackParsed.success) {
        logSchemaFailure(
          req,
          schema,
          'fallback-passed',
          parsed.error.issues,
          input,
          opts.logFields
        )
        // The fallback's output, not T's -- see the return-type doc comment.
        return /** @type {output<T>} */ (fallbackParsed.data)
      }
      if (opts.logOnly) {
        logSchemaFailure(
          req,
          schema,
          'log-only',
          parsed.error.issues,
          input,
          opts.logFields
        )
        // The raw, un-coerced input, not T's -- see the return-type doc
        // comment.
        return /** @type {output<T>} */ (input)
      }
      // Both schemas reject -- no behavior change from what's in production
      // today, so nothing to log. Classify from the fallback's error to
      // preserve production's pre-refinement error shape.
      throwClassified(fallbackParsed.error)
    } else if (opts.logOnly) {
      logSchemaFailure(
        req,
        schema,
        'log-only',
        parsed.error.issues,
        input,
        opts.logFields
      )
      // The raw, un-coerced input, not T's -- see the return-type doc
      // comment.
      return /** @type {output<T>} */ (input)
    }
    // opts present but neither field set: nothing to do in log mode,
    // fall through to throwing as normal.
  } else if (opts && mode() === 'enforce-log') {
    // Throw+log: the outcome is 'enforce's -- classified from the primary
    // schema's error, whatever opts say, since the primary schema is the one
    // being enforced -- but the failure is logged first, so an instrumented
    // call site keeps reporting what is failing after the service moves out
    // of 'log' mode. A fallbackSchema only picks the kind here; it is parsed
    // on the failure path only, so this costs nothing on healthy traffic.
    const fallbackPassed = Boolean(
      opts.fallbackSchema && opts.fallbackSchema.safeParse(input).success
    )
    logSchemaFailure(
      req,
      schema,
      fallbackPassed ? 'enforced-fallback-passed' : 'enforced',
      parsed.error.issues,
      input,
      opts.logFields
    )
  }

  throwClassified(parsed.error)
}

module.exports = {
  parseReq,
  setLogger,
  setReqValidationModeForTests,
  resetReqValidationLoggingForTests,
}
