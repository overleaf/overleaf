import { expect } from 'chai'
import { EditorState } from '@codemirror/state'
import {
  scrubBadChars,
  diffToChangeSpecs,
} from '../../../../../frontend/js/features/source-editor/extensions/composition'

describe('composition', function () {
  describe('scrubBadChars', function () {
    it('collapses one emoji to a single replacement char', function () {
      expect(scrubBadChars('\u{1F600}')).to.equal('�')
    })

    it('collapses each emoji among surrounding text', function () {
      expect(scrubBadChars('a\u{1F600}b\u{1F601}c')).to.equal('a�b�c')
    })

    it('replaces a lone high surrogate', function () {
      expect(scrubBadChars('\uD800')).to.equal('�')
    })

    it('replaces a lone low surrogate', function () {
      expect(scrubBadChars('x\uDC00y')).to.equal('x�y')
    })

    it('replaces a NUL character', function () {
      expect(scrubBadChars('a\0b')).to.equal('a�b')
    })

    it('leaves BMP text unchanged', function () {
      expect(scrubBadChars('Hello にほんご')).to.equal('Hello にほんご')
    })

    it('is idempotent', function () {
      expect(scrubBadChars(scrubBadChars('a\u{1F600}b'))).to.equal('a�b')
    })
  })

  describe('diffToChangeSpecs', function () {
    // Apply the change specs to a `from` document and assert they yield `to`.
    const apply = (from: string, to: string) => {
      const state = EditorState.create({ doc: from })
      return state
        .update({ changes: diffToChangeSpecs(from, to) })
        .state.doc.toString()
    }

    it('transforms by appending', function () {
      expect(apply('hello', 'hello world')).to.equal('hello world')
    })

    it('transforms by deleting', function () {
      expect(apply('hello world', 'hello')).to.equal('hello')
    })

    it('transforms by replacing mid-string', function () {
      expect(apply('abc', 'aXc')).to.equal('aXc')
    })

    it('resyncs an editor holding a composition to a remotely-edited snapshot', function () {
      // editor had "ねこ" composed at the end; snapshot received remote "X" at the start
      expect(apply('abcねこ', 'Xabc')).to.equal('Xabc')
    })

    it('is a no-op when already equal', function () {
      expect(apply('same', 'same')).to.equal('same')
    })
  })
})
