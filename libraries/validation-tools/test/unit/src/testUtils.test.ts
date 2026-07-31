import { describe, expect, it } from 'vitest'
import {
  expectValidationError,
  expectValidationErrorRaw,
} from '../../../testUtils'

function errorBody(status: number, fieldSubstring: string) {
  return JSON.stringify({
    statusCode: status,
    error: `Validation error: Unrecognized key: "${fieldSubstring}" at "body"`,
  })
}

// Mimics a RequestFailedError from @overleaf/fetch-utils: `.response.status`
// and `.body` (raw text).
function asRequestFailedError(status: number, fieldSubstring: string) {
  return {
    response: { status },
    body: errorBody(status, fieldSubstring),
  }
}

// Mimics a raw node:http response object: `.statusCode` and `.body` (raw
// text) directly on the object.
function asRawResponse(status: number, fieldSubstring: string) {
  return {
    statusCode: status,
    body: errorBody(status, fieldSubstring),
  }
}

// Mimics an HTTP client wrapper that never rejects and pre-parses the body
// from JSON before returning it, e.g. templates' fetchWithResponse().
function asResolvedResultWithParsedBody(
  status: number,
  fieldSubstring: string
) {
  return {
    response: { status },
    body: JSON.parse(errorBody(status, fieldSubstring)),
  }
}

describe('expectValidationError', () => {
  it('passes when the status and field substring match', () => {
    const err = asRequestFailedError(400, 'projectId')
    expect(() => expectValidationError(err, 400, 'projectId')).not.toThrow()
  })

  it('throws when the status code does not match', () => {
    const err = asRequestFailedError(400, 'projectId')
    expect(() => expectValidationError(err, 404, 'projectId')).toThrow()
  })

  it('throws when the field substring is not present in the error body', () => {
    const err = asRequestFailedError(400, 'projectId')
    expect(() => expectValidationError(err, 400, 'someOtherField')).toThrow()
  })

  it('throws when the object is not a rejected request', () => {
    expect(() =>
      expectValidationError({ notAResponse: true }, 400, 'projectId')
    ).toThrow()
  })

  it('passes when the body is already parsed into an object', () => {
    const result = asResolvedResultWithParsedBody(404, 'template_id')
    expect(() =>
      expectValidationError(result, 404, 'template_id')
    ).not.toThrow()
  })

  it('throws when the pre-parsed body does not include the field substring', () => {
    const result = asResolvedResultWithParsedBody(404, 'template_id')
    expect(() => expectValidationError(result, 404, 'someOtherField')).toThrow()
  })
})

describe('expectValidationErrorRaw', () => {
  it('passes when the status and field substring match', () => {
    const res = asRawResponse(404, 'filename')
    expect(() => expectValidationErrorRaw(res, 404, 'filename')).not.toThrow()
  })

  it('throws when the status code does not match', () => {
    const res = asRawResponse(404, 'filename')
    expect(() => expectValidationErrorRaw(res, 400, 'filename')).toThrow()
  })

  it('throws when the field substring is not present in the error body', () => {
    const res = asRawResponse(404, 'filename')
    expect(() => expectValidationErrorRaw(res, 404, 'projectId')).toThrow()
  })
})
