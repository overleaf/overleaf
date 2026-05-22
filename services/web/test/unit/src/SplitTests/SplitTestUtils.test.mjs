import { expect } from 'vitest'
import SplitTestUtils from '../../../../app/src/Features/SplitTests/SplitTestUtils.mjs'

describe('SplitTestUtils', function () {
  describe('isExperimentFull', function () {
    describe('when userLimit is null or undefined', function () {
      it('should return false when userLimit is null', function () {
        const variant = {
          userLimit: null,
          userCount: 5,
        }
        expect(SplitTestUtils.isExperimentFull(variant)).toBe(false)
      })

      it('should return false when userLimit is undefined', function () {
        const variant = {
          userCount: 5,
        }
        expect(SplitTestUtils.isExperimentFull(variant)).toBe(false)
      })
    })

    describe('when userLimit is not a number', function () {
      it.each([
        { label: 'NaN', userLimit: NaN },
        { label: 'an object', userLimit: {} },
        { label: 'a string', userLimit: 'string' },
      ])(
        'should return false when userLimit is $label',
        function ({ userLimit }) {
          const variant = {
            userLimit,
            userCount: 50,
          }
          expect(SplitTestUtils.isExperimentFull(variant)).toBe(false)
        }
      )
    })

    it('should return true when userLimit is 0', function () {
      const variant = {
        userLimit: 0,
        userCount: 5,
      }
      expect(SplitTestUtils.isExperimentFull(variant)).toBe(true)
    })

    it('should treat undefined userCount as 0 and return false when under limit', function () {
      const variant = {
        userLimit: 100,
      }
      expect(SplitTestUtils.isExperimentFull(variant)).toBe(false)
    })

    it('should treat null userCount as 0 and return false when under limit', function () {
      const variant = {
        userLimit: 100,
        userCount: null,
      }
      expect(SplitTestUtils.isExperimentFull(variant)).toBe(false)
    })

    it('should treat undefined userCount as 0 and return true when limit is 0', function () {
      const variant = {
        userLimit: 0,
      }
      expect(SplitTestUtils.isExperimentFull(variant)).toBe(true)
    })

    describe('when userCount is below the limit', function () {
      it('should return false when userCount is less than userLimit', function () {
        const variant = {
          userLimit: 100,
          userCount: 50,
        }
        expect(SplitTestUtils.isExperimentFull(variant)).toBe(false)
      })

      it('should return false when userCount is 1 and userLimit is 100', function () {
        const variant = {
          userLimit: 100,
          userCount: 1,
        }
        expect(SplitTestUtils.isExperimentFull(variant)).toBe(false)
      })

      it('should return false when userCount is 0 and userLimit is 100', function () {
        const variant = {
          userLimit: 100,
          userCount: 0,
        }
        expect(SplitTestUtils.isExperimentFull(variant)).toBe(false)
      })
    })

    it('should return true when userCount equals userLimit', function () {
      const variant = {
        userLimit: 100,
        userCount: 100,
      }
      expect(SplitTestUtils.isExperimentFull(variant)).toBe(true)
    })

    it('should return true when userCount is greater than userLimit', function () {
      const variant = {
        userLimit: 100,
        userCount: 150,
      }
      expect(SplitTestUtils.isExperimentFull(variant)).toBe(true)
    })
  })
})
