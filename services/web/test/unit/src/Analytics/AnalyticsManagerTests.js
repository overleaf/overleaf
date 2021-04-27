const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')

const MODULE_PATH = path.join(
  __dirname,
  '../../../../app/src/Features/Analytics/AnalyticsManager'
)

describe('AnalyticsManager', function () {
  beforeEach(function () {
    this.fakeUserId = '123abc'
    this.Settings = {
      analytics: { enabled: true },
    }
    this.analyticsEventsQueue = {
      add: sinon.stub().resolves(),
      process: sinon.stub().resolves(),
    }
    this.analyticsEditingSessionQueue = {
      add: sinon.stub().resolves(),
      process: sinon.stub().resolves(),
    }
    this.onboardingEmailsQueue = {
      add: sinon.stub().resolves(),
      process: sinon.stub().resolves(),
    }
    const self = this
    this.Queues = {
      getAnalyticsEventsQueue: () => {
        return self.analyticsEventsQueue
      },
      getAnalyticsEditingSessionsQueue: () => {
        return self.analyticsEditingSessionQueue
      },
      getOnboardingEmailsQueue: () => {
        return self.onboardingEmailsQueue
      },
    }
    this.backgroundRequest = sinon.stub().yields()
    this.request = sinon.stub().yields()
    this.AnalyticsManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        'settings-sharelatex': this.Settings,
        '../../infrastructure/Queues': this.Queues,
      },
    })
  })

  describe('ignores when', function () {
    it('user is smoke test user', function () {
      this.Settings.smokeTest = { userId: this.fakeUserId }
      this.AnalyticsManager.identifyUser(this.fakeUserId, '')
      sinon.assert.notCalled(this.analyticsEventsQueue.add)
    })

    it('analytics service is disabled', function () {
      this.Settings.analytics.enabled = false
      this.AnalyticsManager.identifyUser(this.fakeUserId, '')
      sinon.assert.notCalled(this.analyticsEventsQueue.add)
    })
  })

  describe('queues the appropriate message for', function () {
    it('identifyUser', function () {
      const oldUserId = '456def'
      this.AnalyticsManager.identifyUser(this.fakeUserId, oldUserId)
      sinon.assert.calledWithMatch(this.analyticsEventsQueue.add, 'identify', {
        userId: this.fakeUserId,
        oldUserId,
      })
    })

    it('recordEvent', function () {
      const event = 'fake-event'
      this.AnalyticsManager.recordEvent(this.fakeUserId, event, null)
      sinon.assert.calledWithMatch(this.analyticsEventsQueue.add, 'event', {
        event,
        userId: this.fakeUserId,
        segmentation: null,
      })
    })

    it('updateEditingSession', function () {
      const projectId = '789ghi'
      const countryCode = 'fr'
      this.AnalyticsManager.updateEditingSession(
        this.fakeUserId,
        projectId,
        countryCode
      )
      sinon.assert.calledWithMatch(this.analyticsEditingSessionQueue.add, {
        userId: this.fakeUserId,
        projectId,
        countryCode,
      })
    })
  })
})
