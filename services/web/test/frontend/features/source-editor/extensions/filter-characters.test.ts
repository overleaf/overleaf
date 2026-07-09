import { expect } from 'chai'
import { EditorState, Transaction } from '@codemirror/state'
import { filterCharacters } from '../../../../../frontend/js/features/source-editor/extensions/filter-characters'

describe('filterCharacters', function () {
  // Insert `text` into a (optionally non-empty) document configured with the
  // filterCharacters extension, and return the resulting document text.
  const applyInsert = (
    text: string,
    opts: { remote?: boolean; doc?: string } = {}
  ) => {
    const doc = opts.doc ?? ''
    const state = EditorState.create({
      doc,
      extensions: [filterCharacters()],
    })
    const tr = state.update({
      changes: { from: doc.length, insert: text },
      annotations: opts.remote ? Transaction.remote.of(true) : undefined,
    })
    return tr.state.doc.toString()
  }

  it('replaces an emoji (surrogate pair) with a single replacement char', function () {
    expect(applyInsert('\u{1F600}')).to.equal('�')
  })

  it('replaces two emoji with two replacement chars', function () {
    expect(applyInsert('\u{1F600}\u{1F601}')).to.equal('��')
  })

  it('preserves text surrounding an emoji', function () {
    expect(applyInsert('a\u{1F600}b')).to.equal('a�b')
  })

  it('replaces a lone high surrogate', function () {
    expect(applyInsert('\uD800')).to.equal('�')
  })

  it('replaces a lone low surrogate', function () {
    expect(applyInsert('x\uDC00y')).to.equal('x�y')
  })

  it('replaces a NUL character', function () {
    expect(applyInsert('\0')).to.equal('�')
  })

  it('leaves ASCII text unchanged', function () {
    expect(applyInsert('hello world')).to.equal('hello world')
  })

  it('leaves BMP CJK text unchanged', function () {
    expect(applyInsert('にほんご')).to.equal('にほんご')
  })

  it('does not scrub remote changes', function () {
    expect(applyInsert('\u{1F600}', { remote: true })).to.equal('\u{1F600}')
  })

  it('is idempotent on already-scrubbed text', function () {
    expect(applyInsert('�')).to.equal('�')
  })
})
