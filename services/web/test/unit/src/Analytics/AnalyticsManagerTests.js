const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')

const MODULE_PATH = path.join(
  __dirname,
  '../../../../app/src/Features/Analytics/AnalyticsManager'
)

describe('AnalyticsManager', function() {
  beforeEach(function() {
    this.fakeUserId = '123abc'
    this.Settings = {
      analytics: { enabled: true }
    }

    this.Queues = {
      analytics: {
        events: {
          add: sinon.stub().resolves()
        },
        editingSessions: {
          add: sinon.stub().resolves()
        }
      }
    }
    this.backgroundRequest = sinon.stub().yields()
    this.request = sinon.stub().yields()
    this.AnalyticsManager = SandboxedModule.require(MODULE_PATH, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': this.Settings,
        'logger-sharelatex': {
          warn() {}
        },
        '../../infrastructure/Queues': this.Queues
      }
    })
  })

  describe('ignores when', function() {
    it('user is smoke test user', function() {
      this.Settings.smokeTest = { userId: this.fakeUserId }
      this.AnalyticsManager.identifyUser(this.fakeUserId, '')
      sinon.assert.notCalled(this.Queues.analytics.events.add)
    })

    it('analytics service is disabled', function() {
      this.Settings.analytics.enabled = false
      this.AnalyticsManager.identifyUser(this.fakeUserId, '')
      sinon.assert.notCalled(this.Queues.analytics.events.add)
    })
  })

  describe('queues the appropriate message for', function() {
    it('identifyUser', function() {
      const oldUserId = '456def'
      this.AnalyticsManager.identifyUser(this.fakeUserId, oldUserId)
      sinon.assert.calledWithMatch(
        this.Queues.analytics.events.add,
        'identify',
        {
          userId: this.fakeUserId,
          oldUserId
        }
      )
    })

    it('recordEvent', function() {
      const event = 'fake-event'
      this.AnalyticsManager.recordEvent(this.fakeUserId, event, null)
      sinon.assert.calledWithMatch(this.Queues.analytics.events.add, 'event', {
        event,
        userId: this.fakeUserId,
        segmentation: null
      })
    })

    it('updateEditingSession', function() {
      const projectId = '789ghi'
      const countryCode = 'fr'
      this.AnalyticsManager.updateEditingSession(
        this.fakeUserId,
        projectId,
        countryCode
      )
      sinon.assert.calledWithMatch(this.Queues.analytics.editingSessions.add, {
        userId: this.fakeUserId,
        projectId,
        countryCode
      })
    })
  })
})
