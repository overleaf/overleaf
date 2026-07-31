// @ts-check

/**
 * Access to the request-input lockdown installed by our patched express
 * (see .yarn/patches/express-npm-*.patch).
 *
 * With REQ_LOCKDOWN_MODE=warn|throw, express captures parsed request input in
 * the symbol-keyed fields below and turns the public req.body / req.query /
 * req.params into accessors that warn or throw on read. Request input must be
 * read through parseReq(), which validates it against a zod schema, or — for
 * the small allowlist of infrastructure middleware that legitimately needs
 * unvalidated input (authentication, rate limiting, CSRF, ...) — through
 * getRawReqInput() so that the access is explicit and greppable.
 *
 * The symbols live in the global symbol registry, shared with the express and
 * body-parser patches.
 */

const RAW_BODY = Symbol.for('overleaf.lockdown.rawBody')
const RAW_QUERY = Symbol.for('overleaf.lockdown.rawQuery')
const RAW_PARAMS = Symbol.for('overleaf.lockdown.rawParams')
const INSTALLED = Symbol.for('overleaf.lockdown.installed')

/**
 * @typedef {import('express').Request} Request
 */

/**
 * Whether the lockdown accessors are installed on this request
 * (REQ_LOCKDOWN_MODE=warn|throw).
 *
 * @param {Request} req
 * @returns {boolean}
 */
function isLockdownInstalled(req) {
  // @ts-ignore symbol-keyed field added by the express patch
  return Boolean(req[INSTALLED])
}

/**
 * Read raw, unvalidated request input, bypassing the lockdown.
 *
 * Allowlisted infrastructure middleware only — application code (routes,
 * controllers) must use parseReq() with a zod schema instead.
 *
 * @param {Request} req
 * @returns {{ params: any, query: any, body: any }}
 */
function getRawReqInput(req) {
  if (!isLockdownInstalled(req)) {
    return { params: req.params, query: req.query, body: req.body }
  }
  return {
    // @ts-ignore symbol-keyed fields added by the express patch
    params: req[RAW_PARAMS],
    // @ts-ignore
    query: req[RAW_QUERY],
    // @ts-ignore
    body: req[RAW_BODY],
  }
}

module.exports = {
  RAW_BODY,
  RAW_QUERY,
  RAW_PARAMS,
  INSTALLED,
  isLockdownInstalled,
  getRawReqInput,
}
