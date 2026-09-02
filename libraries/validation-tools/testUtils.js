const assert = require('node:assert/strict')

function asZodError(...def) {
  return {
    name: 'ZodError',
    _zod: { def },
  }
}

/**
 * Parses (if needed) a validation-error response body and asserts that it
 * matches the given status and names the given field.
 *
 * handleValidationError (see ./handleValidationError.js) responds with
 * `{ error: fromError(err.zodError).toString(), statusCode }`, and
 * fromError's message includes the offending field's dotted schema path
 * (e.g. `at "params.projectId"`, or the failing key name for an
 * unrecognized key), so asserting the field name appears in `body.error`
 * pins the test to the intended failure rather than merely the status code.
 *
 * @param {string|{statusCode: number, error: string}} rawOrParsedBody - the
 *   response body, either as raw JSON text or already parsed into an object
 *   (some HTTP client wrappers pre-parse the body for the caller)
 * @param {number} status
 * @param {string} fieldSubstring
 */
function assertValidationErrorBody(rawOrParsedBody, status, fieldSubstring) {
  assert.ok(rawOrParsedBody != null, 'expected a response body')
  const body =
    typeof rawOrParsedBody === 'string'
      ? JSON.parse(rawOrParsedBody)
      : rawOrParsedBody
  assert.equal(body.statusCode, status)
  assert.equal(typeof body.error, 'string')
  assert.ok(
    body.error.includes(fieldSubstring),
    `expected error message ${JSON.stringify(body.error)} to include ${JSON.stringify(fieldSubstring)}`
  )
}

/**
 * Asserts that a request was actually rejected by the zod validation layer
 * because of the specific field named in `fieldSubstring` -- not just any
 * error/response that happens to produce the same status code. See
 * assertValidationErrorBody() above.
 *
 * @param {any} errorOrResult - either the object thrown/rejected by a failed
 *   request, e.g. a RequestFailedError from @overleaf/fetch-utils (exposes
 *   `.response.status` and `.body` as raw text), or a resolved
 *   `{ response, body }` pair from an HTTP client wrapper that never rejects
 *   on non-2xx responses and has already parsed `body` from JSON. Either way
 *   expected to expose `.response.status` and `.body`
 * @param {number} status - the expected HTTP status code
 * @param {string} fieldSubstring - a substring expected in the error
 *   message identifying the rejected field (e.g. a param/body/query key)
 */
function expectValidationError(errorOrResult, status, fieldSubstring) {
  assert.equal(
    errorOrResult && errorOrResult.response && errorOrResult.response.status,
    status,
    `expected response.status === ${status}`
  )
  assertValidationErrorBody(errorOrResult.body, status, fieldSubstring)
}

/**
 * Same as expectValidationError, but for a response object that exposes
 * `statusCode` and `body` directly rather than nested under `.response`
 * (e.g. a raw node:http response).
 *
 * @param {any} res - expected to expose `.statusCode` and `.body` directly
 * @param {number} status
 * @param {string} fieldSubstring
 */
function expectValidationErrorRaw(res, status, fieldSubstring) {
  assert.equal(
    res && res.statusCode,
    status,
    `expected a response with statusCode === ${status}`
  )
  assertValidationErrorBody(res.body, status, fieldSubstring)
}

module.exports = {
  asZodError,
  expectValidationError,
  expectValidationErrorRaw,
}
