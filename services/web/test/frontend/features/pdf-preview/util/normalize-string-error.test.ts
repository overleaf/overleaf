import { expect } from 'chai'
import OError from '@overleaf/o-error'
import { normalizeStringError } from '@/features/pdf-preview/util/normalize-string-error'

describe('normalizeStringError', function () {
  it('wraps a string in an Error so OError.tag/Sentry can consume it', function () {
    // V8 throws the bare string "out of memory" (instead of an Error) from
    // some buffer-allocation paths (e.g. `new Uint8Array(N)`,
    // `Response.prototype.arrayBuffer()`).
    const result = normalizeStringError('out of memory')
    expect(result).to.be.an.instanceOf(Error)
    expect((result as Error).message).to.equal('out of memory')
    expect((result as Error).stack).to.be.a('string')
  })

  it('returns an Error instance unchanged', function () {
    const original = new Error('boom')
    expect(normalizeStringError(original)).to.equal(original)
  })

  it('returns a custom Error subclass unchanged', function () {
    class CustomError extends Error {}
    const original = new CustomError('boom')
    expect(normalizeStringError(original)).to.equal(original)
  })

  it('returns non-string non-Error values unchanged so genuine bugs surface', function () {
    // The helper deliberately does not wrap `null`/`undefined`/numbers/etc.,
    // so code paths that `throw null` or `throw 42` continue to surface as
    // bugs rather than being masked.
    expect(normalizeStringError(null)).to.equal(null)
    expect(normalizeStringError(undefined)).to.equal(undefined)
    expect(normalizeStringError(42)).to.equal(42)
    const obj = { foo: 'bar' }
    expect(normalizeStringError(obj)).to.equal(obj)
  })

  it('produces an Error that OError.tag can attach metadata to', function () {
    // Round-trip the realistic usage: tag a normalised string error with
    // some info, and verify both the tag and the info make it through.
    const err = OError.tag(
      normalizeStringError('out of memory'),
      'fallback request failed',
      { url: '/project/abc/output.pdf', start: 0, end: 1024 }
    )
    expect(err).to.be.an.instanceOf(Error)
    expect((err as Error).message).to.equal('out of memory')
    expect(OError.getFullInfo(err)).to.deep.include({
      url: '/project/abc/output.pdf',
      start: 0,
      end: 1024,
    })
  })
})
