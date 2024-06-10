import { expect } from 'chai'
import { generateSHA1Hash } from '../../../../frontend/js/shared/utils/sha1'
import crypto from 'node:crypto'

function generateSHA1HashNode(content) {
  return crypto.createHash('sha1').update(content, 'utf8').digest('hex')
}

function generateRandomUnicodeString(length) {
  let result = ''
  for (let i = 0; i < length; i++) {
    const range = [0x0000, 0x10ffff]
    const codePoint =
      Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0]
    result += String.fromCharCode(codePoint)
  }
  return result
}

function generateMultipleRandomStrings(numStrings, maxLength) {
  const randomStrings = []
  for (let i = 0; i < numStrings; i++) {
    const length = Math.floor(Math.random() * maxLength)
    randomStrings.push(generateRandomUnicodeString(length))
  }
  return [...new Set(randomStrings)]
}

describe('sha1', function () {
  describe('generateSHA1Hash', function () {
    const randomStrings = generateMultipleRandomStrings(100, 1000)

    it('verify 100 random strings', function () {
      for (const str of randomStrings) {
        expect(generateSHA1Hash(str)).to.equal(generateSHA1HashNode(str))
      }
    })

    it('sample string 1', function () {
      expect(generateSHA1Hash('sample string 1')).to.equal(
        '135028161629af5901ea2f15554730dc0de38a01'
      )
    })

    it('sample string 2', function () {
      expect(generateSHA1Hash('sample string 2')).to.equal(
        'db9460374e49a7c737b609c2fb37302381f345d6'
      )
    })

    it('abc', function () {
      expect(generateSHA1Hash('abc')).to.equal(
        'a9993e364706816aba3e25717850c26c9cd0d89d'
      )
    })

    it('generates a sha1 for an empty string', function () {
      expect(generateSHA1Hash('')).to.equal(
        'da39a3ee5e6b4b0d3255bfef95601890afd80709'
      )
    })

    it('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', function () {
      expect(
        generateSHA1Hash(
          'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'
        )
      ).to.equal('84983e441c3bd26ebaae4aa1f95129e5e54670f1')
    })

    it('abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu', function () {
      expect(
        generateSHA1Hash(
          'abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu'
        )
      ).to.equal('a49b2446a02c645bf419f995b67091253a04a259')
    })
  })
})
