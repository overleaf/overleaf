import firstCharacter from '@/shared/utils/first-character'
import { expect } from 'chai'
import sinon from 'sinon'

const CASES_ALL = [
  // Regular ASCII characters
  ['Hello', 'H'],
  // Multi-byte characters (e.g. Chinese)
  ['你好', '你'],
  // Multi-byte characters (e.g. emojis)
  ['😀 Smile', '😀'],
  // Empty string
  ['', ''],
]

const CASES_SEGMENTER = [
  // Regional indicator symbols (e.g. flag emojis)
  ['🇩🇰 Denmark', '🇩🇰'],
  // ZWJ sequences (e.g. family emoji)
  ['👩‍👩‍👧‍👦 Family', '👩‍👩‍👧‍👦'],
  // Combining characters (e.g. accented characters)
  ['e\u0301 Accented', 'e\u0301'],
  ['é Accented', 'é'],
]

describe('firstCharacter', function () {
  it('works for different types of strings', function () {
    for (const [input, expected] of CASES_ALL) {
      expect(firstCharacter(input)).to.equal(expected)
    }
    for (const [input, expected] of CASES_SEGMENTER) {
      expect(firstCharacter(input)).to.equal(expected)
    }
  })

  describe('when Intl.Segmenter is unavailable', function () {
    before(function () {
      this.segmenterStub = sinon.stub(Intl, 'Segmenter').value(undefined)
    })

    after(function () {
      this.segmenterStub.restore()
    })

    it('falls back to the code point approach', function () {
      for (const [input, expected] of CASES_ALL) {
        expect(firstCharacter(input)).to.equal(expected)
      }
    })
  })
})
