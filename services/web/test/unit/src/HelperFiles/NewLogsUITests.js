const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const { ObjectId } = require('mongodb')
const MODULE_PATH = require('path').join(
  __dirname,
  '../../../../app/src/Features/Helpers/NewLogsUI.js'
)

describe('NewLogsUI helper', function () {
  let NewLogsUI

  before(function () {
    // We're disabling the Logs UI split test while rolling out the PDF Preview
    this.skip()
  })

  function userIdFromTime(time) {
    return ObjectId.createFromTime(time).toString()
  }

  function isExistingUI(variant) {
    return !variant.newLogsUI && !variant.subvariant
  }

  function isNewUIWithPopup(variant) {
    return variant.newLogsUI && variant.subvariant === 'new-logs-ui-with-popup'
  }

  function isNewUIWithoutPopup(variant) {
    return (
      variant.newLogsUI && variant.subvariant === 'new-logs-ui-without-popup'
    )
  }

  function getTestInterval(lowerBoundary, upperBoundary) {
    const midpoint = Math.floor(
      lowerBoundary + (upperBoundary - lowerBoundary) / 2
    )
    return [lowerBoundary, midpoint, upperBoundary]
  }

  beforeEach(function () {
    this.user = {
      alphaProgram: false,
      _id: ObjectId('60085414b76eeb00737d93aa'),
    }
    this.settings = {
      overleaf: {
        foo: 'bar',
      },
    }

    NewLogsUI = SandboxedModule.require(MODULE_PATH, {
      requires: {
        mongodb: { ObjectId },
        '@overleaf/settings': this.settings,
      },
    })
  })

  describe('In a non-SaaS context', function () {
    beforeEach(function () {
      delete this.settings.overleaf
    })
    it('should always show the existing UI', function () {
      for (const percentile of [0, 20, 40, 60, 80]) {
        this.user._id = userIdFromTime(percentile)
        const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
        expect(isExistingUI(variant)).to.be.true
      }
    })
  })

  describe('For alpha users', function () {
    beforeEach(function () {
      this.user.alphaProgram = true
    })
    it('should always show the new UI with popup', function () {
      for (const percentile of [0, 20, 40, 60, 80]) {
        this.user._id = userIdFromTime(percentile)
        const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
        expect(isNewUIWithPopup(variant)).to.be.true
      }
    })
  })

  describe('For regular users', function () {
    it('should show the new UI with popup when the id is in the [0, 5[ interval', function () {
      const testInterval = getTestInterval(0, 4)
      for (const percentile of testInterval) {
        this.user._id = userIdFromTime(percentile)
        const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
        expect(isNewUIWithPopup(variant)).to.be.true
      }
      this.user._id = userIdFromTime(5)
      const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
      expect(isNewUIWithPopup(variant)).to.be.false
    })
    it('should show the new UI without popup when the id is in the [5, 10[ interval', function () {
      const testInterval = getTestInterval(5, 9)
      for (const percentile of testInterval) {
        this.user._id = userIdFromTime(percentile)
        const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
        expect(isNewUIWithoutPopup(variant)).to.be.true
      }
      this.user._id = userIdFromTime(10)
      const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
      expect(isNewUIWithoutPopup(variant)).to.be.false
    })
    it('should show the new UI with popup when the id is in the [10, 38[ interval', function () {
      const testInterval = getTestInterval(10, 37)
      for (const percentile of testInterval) {
        this.user._id = userIdFromTime(percentile)
        const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
        expect(isNewUIWithPopup(variant)).to.be.true
      }
      this.user._id = userIdFromTime(38)
      const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
      expect(isNewUIWithPopup(variant)).to.be.false
    })
    it('should show the new UI without popup when the id is in the [38, 66[ interval', function () {
      const testInterval = getTestInterval(38, 65)
      for (const percentile of testInterval) {
        this.user._id = userIdFromTime(percentile)
        const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
        expect(isNewUIWithoutPopup(variant)).to.be.true
      }
      this.user._id = userIdFromTime(66)
      const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
      expect(isNewUIWithoutPopup(variant)).to.be.false
    })
    it('should show the existing UI when the id is in the [66, 99] interval', function () {
      const testInterval = getTestInterval(66, 99)
      for (const percentile of testInterval) {
        this.user._id = userIdFromTime(percentile)
        const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
        expect(isExistingUI(variant)).to.be.true
      }
      this.user._id = userIdFromTime(100)
      const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
      expect(isExistingUI(variant)).to.be.false
    })
  })
})
