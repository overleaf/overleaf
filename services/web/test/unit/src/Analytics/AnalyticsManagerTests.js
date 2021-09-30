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
    this.analyticsId = '123456'
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
    this.analyticsUserPropertiesQueue = {
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
      getAnalyticsUserPropertiesQueue: () => {
        return self.analyticsUserPropertiesQueue
      },
    }
    this.backgroundRequest = sinon.stub().yields()
    this.request = sinon.stub().yields()
    this.AnalyticsManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '@overleaf/settings': this.Settings,
        '../../infrastructure/Queues': this.Queues,
        './UserAnalyticsIdCache': (this.UserAnalyticsIdCache = {
          get: sinon.stub().resolves(this.analyticsId),
        }),
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

    it('userId or analyticsId is missing', function () {
      this.AnalyticsManager.identifyUser(this.fakeUserId, undefined)
      sinon.assert.notCalled(this.analyticsEventsQueue.add)
    })

    it('userId equal analyticsId', function () {
      this.AnalyticsManager.identifyUser(this.fakeUserId, this.fakeUserId)
      sinon.assert.notCalled(this.analyticsEventsQueue.add)
    })
  })

  describe('queues the appropriate message for', function () {
    it('identifyUser', function () {
      const analyticsId = '456def'
      this.AnalyticsManager.identifyUser(this.fakeUserId, analyticsId)
      sinon.assert.calledWithMatch(this.analyticsEventsQueue.add, 'identify', {
        userId: this.fakeUserId,
        analyticsId,
      })
    })

    it('recordEventForUser', async function () {
      const event = 'fake-event'
      await this.AnalyticsManager.recordEventForUser(
        this.fakeUserId,
        event,
        null
      )
      sinon.assert.calledWithMatch(this.analyticsEventsQueue.add, 'event', {
        analyticsId: this.analyticsId,
        event,
        segmentation: null,
        isLoggedIn: true,
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
      sinon.assert.calledWithMatch(
        this.analyticsEditingSessionQueue.add,
        'editing-session',
        {
          userId: this.fakeUserId,
          projectId,
          countryCode,
        }
      )
    })
  })
})
