const { expect } = require('chai')
const { sampleByHash } = require('../../../app/js/StatsManager')

describe('StatsManager', function () {
  describe('sampleByHash', function () {
    it('should always return false for a sample percentage of 0', function () {
      for (let i = 0; i < 100; i++) {
        const key = `test-key-${i}`
        expect(sampleByHash(key, 0), `key ${key} should be false`).to.be.false
      }
    })

    it('should always return false for a negative sample percentage', function () {
      for (let i = 0; i < 100; i++) {
        const key = `test-key-${i}`
        expect(sampleByHash(key, -10), `key ${key} should be false`).to.be.false
      }
    })

    it('should always return true for a sample percentage of 100', function () {
      // This isn't strictly true, if the hash is exactly 0xffffffff, then the percentile is 100
      // and 100 < 100 is false. But the chances of that are 1 in 4 billion.
      for (let i = 0; i < 100; i++) {
        const key = `test-key-${i}`
        expect(sampleByHash(key, 100), `key ${key} should be true`).to.be.true
      }
    })

    it('should return the expected number of results for a sample percentage of 75', function () {
      // This isn't strictly true, if the hash is exactly 0xffffffff, then the percentile is 100
      // and 100 < 100 is false. But the chances of that are 1 in 4 billion.
      let count = 0
      for (let i = 0; i < 100; i++) {
        const key = `test-key-${i}`
        count += sampleByHash(key, 75) ? 1 : 0
      }
      // Actual result is 74, it's deterministic but the test allows the algorithm to change
      expect(count).to.be.within(70, 80)
    })

    it('should return true when the hash is within the sample percentage', function () {
      // The MD5 hash of 'test-key-in' gives a percentile of 13
      const key = 'test-key-in'
      const percentage = 40
      expect(sampleByHash(key, percentage)).to.be.true
    })

    it('should return false when the hash is outside the sample percentage', function () {
      // The MD5 hash of 'test-key-outer' gives a percentile of 47
      const key = 'test-key-outer'
      const percentage = 40
      expect(sampleByHash(key, percentage)).to.be.false
    })

    it('should produce consistent results for the same key', function () {
      const key = 'consistent-key'
      const percentage = 50
      const result1 = sampleByHash(key, percentage)
      const result2 = sampleByHash(key, percentage)
      expect(result1).to.equal(result2)
    })

    it('should handle different keys correctly', function () {
      // MD5('key1') => percentile 76
      // MD5('key2') => percentile 47
      expect(sampleByHash('key1', 80)).to.be.true
      expect(sampleByHash('key1', 70)).to.be.false
      expect(sampleByHash('key2', 50)).to.be.true
      expect(sampleByHash('key2', 40)).to.be.false
    })

    it('should be monotonic with respect to percentage', function () {
      const key = 'test-key'
      const percentile = 32
      for (let i = 0; i <= 100; i++) {
        const result = sampleByHash(key, i)
        if (i <= percentile) {
          expect(result, `percentage ${i} should be false`).to.be.false
        } else {
          expect(result, `percentage ${i} should be true`).to.be.true
        }
      }
    })
  })
})
