const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const { ObjectId } = require('mongodb')
const MODULE_PATH = require('path').join(
  __dirname,
  '../../../../app/src/Features/Helpers/NewLogsUI.js'
)

describe('NewLogsUI helper', function() {
  let NewLogsUI

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

  beforeEach(function() {
    this.user = {
      alphaProgram: false,
      betaProgram: false,
      _id: ObjectId('60085414b76eeb00737d93aa')
    }
    this.settings = {
      logsUIPercentageBeta: 0,
      logsUIPercentageWithoutPopupBeta: 0,
      logsUIPercentage: 0,
      logsUIPercentageWithoutPopup: 0
    }
    NewLogsUI = SandboxedModule.require(MODULE_PATH, {
      requires: {
        mongodb: { ObjectId },
        'settings-sharelatex': this.settings
      }
    })
  })

  it('should always show the new UI with popup for alpha users', function() {
    this.user.alphaProgram = true
    for (const percentile of [0, 20, 40, 60, 80]) {
      this.user._id = userIdFromTime(percentile)
      const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
      expect(isNewUIWithPopup(variant)).to.be.true
    }
  })

  describe('for beta users', function() {
    beforeEach(function() {
      this.user.betaProgram = true
    })

    describe('with a 0% rollout', function() {
      it('should always show the existing UI', function() {
        for (const percentile of [0, 20, 40, 60, 80]) {
          this.user._id = userIdFromTime(percentile)
          const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
          expect(isExistingUI(variant)).to.be.true
        }
      })
    })

    describe('with a new UI rollout', function() {
      const newUIWithPopupPercentage = 33
      const newUIWithoutPopupPercentage = 33

      const newUIWithPopupThreshold = newUIWithPopupPercentage
      const newUIWithoutPopupThreshold =
        newUIWithPopupPercentage + newUIWithoutPopupPercentage

      beforeEach(function() {
        this.settings.logsUIPercentageBeta = newUIWithPopupPercentage
        this.settings.logsUIPercentageWithoutPopupBeta = newUIWithoutPopupPercentage
      })
      it('should show the new UI with popup when the id is below the new UI with popup upper threshold (exc)', function() {
        this.user._id = userIdFromTime(newUIWithPopupThreshold - 1)
        const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
        expect(isNewUIWithPopup(variant)).to.be.true
      })
      it('should show the new UI without popup when the id is at the new UI with popup upper threshold (exc)', function() {
        this.user._id = userIdFromTime(newUIWithPopupThreshold)
        const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
        expect(isNewUIWithoutPopup(variant)).to.be.true
      })
      it('should show the new UI without popup when the id is above the new UI with popup upper threshold (inc) and below the new UI without popup upper threshold (exc)', function() {
        this.user._id = userIdFromTime(newUIWithoutPopupThreshold - 1)
        const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
        expect(isNewUIWithoutPopup(variant)).to.be.true
      })
      it('should show the existing UI when the id is at the new UI without popup upper threshold (exc)', function() {
        this.user._id = userIdFromTime(newUIWithoutPopupThreshold)
        const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
        expect(isExistingUI(variant)).to.be.true
      })
      it('should show the existing UI when the id is above the new UI without popup upper threshold (exc)', function() {
        this.user._id = userIdFromTime(newUIWithoutPopupThreshold + 1)
        const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
        expect(isExistingUI(variant)).to.be.true
      })
    })
  })

  describe('for regular users', function() {
    describe('with a 0% rollout', function() {
      it('should always show the existing UI', function() {
        for (const percentile of [0, 20, 40, 60, 80]) {
          this.user._id = userIdFromTime(percentile)
          const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
          expect(isExistingUI(variant)).to.be.true
        }
      })
    })

    describe('with a new UI rollout', function() {
      const newUIWithPopupPercentage = 33
      const newUIWithoutPopupPercentage = 33

      const newUIWithPopupThreshold = newUIWithPopupPercentage
      const newUIWithoutPopupThreshold =
        newUIWithPopupPercentage + newUIWithoutPopupPercentage

      beforeEach(function() {
        this.settings.logsUIPercentage = newUIWithPopupPercentage
        this.settings.logsUIPercentageWithoutPopup = newUIWithoutPopupPercentage
      })
      it('should show the new UI with popup when the id is below the new UI with popup upper threshold (exc)', function() {
        this.user._id = userIdFromTime(newUIWithPopupThreshold - 1)
        const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
        expect(isNewUIWithPopup(variant)).to.be.true
      })
      it('should show the new UI without popup when the id is at the new UI with popup upper threshold (exc)', function() {
        this.user._id = userIdFromTime(newUIWithPopupThreshold)
        const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
        expect(isNewUIWithoutPopup(variant)).to.be.true
      })
      it('should show the new UI without popup when the id is above the new UI with popup upper threshold (inc) and below the new UI without popup upper threshold (exc)', function() {
        this.user._id = userIdFromTime(newUIWithoutPopupThreshold - 1)
        const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
        expect(isNewUIWithoutPopup(variant)).to.be.true
      })
      it('should show the existing UI when the id is at the new UI without popup upper threshold (exc)', function() {
        this.user._id = userIdFromTime(newUIWithoutPopupThreshold)
        const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
        expect(isExistingUI(variant)).to.be.true
      })
      it('should show the existing UI when the id is above the new UI without popup upper threshold (exc)', function() {
        this.user._id = userIdFromTime(newUIWithoutPopupThreshold + 1)
        const variant = NewLogsUI.getNewLogsUIVariantForUser(this.user)
        expect(isExistingUI(variant)).to.be.true
      })
    })
  })
})
