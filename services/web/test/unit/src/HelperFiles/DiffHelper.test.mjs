import { expect } from 'vitest'
import { stringSimilarity } from '../../../../app/src/Features/Helpers/DiffHelper.mjs'

describe('DiffHelper', function () {
  describe('stringSimilarity', function () {
    it('should have a ratio of 1 for identical strings', function () {
      expect(stringSimilarity('abcdef', 'abcdef')).to.equal(1.0)
    })

    it('should have a ratio of 0 for completely different strings', function () {
      expect(stringSimilarity('abcdef', 'qmglzxv')).to.equal(0.0)
    })

    it('should have a ratio of between 0 and 1 for strings that are similar', function () {
      const ratio = stringSimilarity('abcdef', 'abcdef@zxvkp')
      expect(ratio).to.equal(0.66)
    })

    it('should reject non-string inputs', function () {
      expect(() => stringSimilarity(1, 'abc')).to.throw
      expect(() => stringSimilarity('abc', 2)).to.throw
      expect(() => stringSimilarity('abc', new Array(1000).fill('a').join('')))
        .to.throw
    })
  })
})
