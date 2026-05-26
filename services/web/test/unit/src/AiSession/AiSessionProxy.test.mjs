import { describe, expect, it } from 'vitest'
import AiSessionProxy from '../../../../app/src/Features/AiSession/AiSessionProxy.mjs'

describe('AiSessionProxy._parseMount', () => {
  const parse = AiSessionProxy._parseMount

  it('parses sessionId and root path', () => {
    expect(parse('/ai/session/0123456789abcdef0123456789abcdef')).to.deep.equal({
      sessionId: '0123456789abcdef0123456789abcdef',
      remainder: '/',
    })
  })

  it('parses sessionId and subpath', () => {
    expect(
      parse('/ai/session/0123456789abcdef/_static/foo.js?bar=1')
    ).to.deep.equal({
      sessionId: '0123456789abcdef',
      remainder: '/_static/foo.js?bar=1',
    })
  })

  it('returns null for a non-matching prefix', () => {
    expect(parse('/project/abc/edit')).to.equal(null)
  })

  it('returns null for an invalid session id', () => {
    expect(parse('/ai/session/short')).to.equal(null)
    expect(parse('/ai/session/UPPERHEX0123456789abcdef0123456789')).to.equal(
      null
    )
  })
})
