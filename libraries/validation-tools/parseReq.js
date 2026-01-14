// @ts-check
const { ParamsError } = require('./Errors')

/**
 * @typedef {import('zod').ZodType} ZodType
 * @typedef {import('express').Request} Request
 */

/**
 * @template T
 * @typedef {import('zod').output<T>} output<T>
 */

/**
 * Parse and validate a request against a Zod schema
 *
 * @template {ZodType} T
 * @param {Request} req - The Express request object
 * @param {T} schema - The Zod schema to validate against
 * @returns {output<T>} The validated request object
 */
function parseReq(req, schema) {
  const parsed = schema.safeParse(req)
  if (parsed.success) {
    return parsed.data
  } else if (parsed.error.issues.some(issue => issue.path[0] === 'params')) {
    // Parts of the URL path failed to validate; throw a specific error
    throw new ParamsError('Invalid params').withCause(parsed.error)
  } else {
    throw parsed.error
  }
}

module.exports = { parseReq }
