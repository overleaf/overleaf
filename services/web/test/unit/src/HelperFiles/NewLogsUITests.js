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

  beforeEach(function() {
    this.user = {
      alphaProgram: false,
      betaProgram: false,
      _id: ObjectId('60085414b76eeb00737d93aa')
    }
    this.settings = {
      logsUIPercentageBeta: 0,
      logsUIPercentage: 0
    }
    NewLogsUI = SandboxedModule.require(MODULE_PATH, {
      requires: {
        mongodb: { ObjectId },
        'settings-sharelatex': this.settings
      }
    })
  })

  it('should show the new logs ui for alpha users', function() {
    this.user.alphaProgram = true
    expect(NewLogsUI.shouldUserSeeNewLogsUI(this.user)).to.be.true
  })

  describe('for beta users', function() {
    beforeEach(function() {
      this.user.betaProgram = true
    })
    it('should not show the new logs ui with a beta rollout percentage of 0', function() {
      this.settings.logsUIPercentageBeta = 0
      expect(NewLogsUI.shouldUserSeeNewLogsUI(this.user)).to.be.false
    })
    describe('with a beta rollout percentage > 0', function() {
      const percentileThresold = 50
      beforeEach(function() {
        this.settings.logsUIPercentageBeta = percentileThresold
      })
      it('should not show the new logs ui when the user id is higher than the percent threshold', function() {
        this.user._id = userIdFromTime(percentileThresold + 1)
        expect(NewLogsUI.shouldUserSeeNewLogsUI(this.user)).to.be.false
      })
      it('should show the new logs ui when the user id is lower than the percent threshold', function() {
        this.user._id = userIdFromTime(percentileThresold - 1)
        expect(NewLogsUI.shouldUserSeeNewLogsUI(this.user)).to.be.true
      })
    })
  })

  describe('for normal users', function() {
    it('should not show the new logs ui rollout percentage of 0', function() {
      this.settings.logsUIPercentage = 0
      expect(NewLogsUI.shouldUserSeeNewLogsUI(this.user)).to.be.false
    })
    describe('with a rollout percentage > 0', function() {
      const percentileThresold = 50
      beforeEach(function() {
        this.settings.logsUIPercentage = percentileThresold
      })
      it('should not show the new logs ui when the user id is higher than the percent threshold', function() {
        this.user._id = userIdFromTime(percentileThresold + 1)
        expect(NewLogsUI.shouldUserSeeNewLogsUI(this.user)).to.be.false
      })
      it('should show the new logs ui when the user id is lower than the percent threshold', function() {
        this.user._id = userIdFromTime(percentileThresold - 1)
        expect(NewLogsUI.shouldUserSeeNewLogsUI(this.user)).to.be.true
      })
    })
  })
})
