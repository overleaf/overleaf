const { expect } = require('chai')
const { textToOps, applyOps } = require('../lib/diff')

describe('diff', () => {
  function roundtrip(before, after) {
    const ops = textToOps(before, after)
    const result = applyOps(before, ops)
    expect(result).to.equal(after)
    return ops
  }

  it('returns no ops for identical strings', () => {
    expect(textToOps('hello', 'hello')).to.deep.equal([])
  })

  it('emits a single insert for a pure prepend', () => {
    const ops = roundtrip('world', 'hello world')
    expect(ops).to.deep.equal([{ i: 'hello ', p: 0 }])
  })

  it('emits a single insert for a pure append', () => {
    const ops = roundtrip('hello', 'hello world')
    expect(ops).to.deep.equal([{ i: ' world', p: 5 }])
  })

  it('emits a single delete for a pure removal', () => {
    const ops = roundtrip('hello world', 'world')
    expect(ops).to.deep.equal([{ d: 'hello ', p: 0 }])
  })

  it('emits delete+insert for a single contiguous replacement', () => {
    const ops = roundtrip('hello world', 'hello there')
    expect(ops).to.have.lengthOf(2)
    expect(ops[0]).to.deep.equal({ d: 'world', p: 6 })
    expect(ops[1]).to.deep.equal({ i: 'there', p: 6 })
  })

  it('handles multi-region edits via diff-match-patch', () => {
    const before = 'a'.repeat(200) + 'XXX' + 'b'.repeat(200) + 'YYY' + 'c'.repeat(200)
    const after = 'a'.repeat(200) + 'AAA' + 'b'.repeat(200) + 'BBB' + 'c'.repeat(200)
    roundtrip(before, after)
  })

  it('handles unicode correctly', () => {
    roundtrip('héllo wörld', 'héllo dëar wörld')
  })

  it('handles inserting newlines', () => {
    roundtrip('one two three', 'one\ntwo\nthree')
  })

  it('applyOps throws on delete mismatch', () => {
    expect(() => applyOps('abc', [{ d: 'xyz', p: 0 }])).to.throw(/delete mismatch/)
  })
})
