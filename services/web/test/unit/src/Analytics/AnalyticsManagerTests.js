const SandboxedModule = require('sandboxed-module')
const path = require('path')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/Analytics/AnalyticsManager'
)
const sinon = require('sinon')
const { expect } = require('chai')
const Errors = require('../../../../app/src/Features/Errors/Errors')

describe('AnalyticsManager', function() {
  beforeEach(function() {
    this.fakeUserId = '123abc'
    this.settings = {
      overleaf: true,
      apis: { analytics: { url: 'analytics.test' } }
    }
    this.backgroundRequest = sinon.stub().yields()
    this.request = sinon.stub().yields()
    this.AnalyticsManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': this.settings,
        '../../infrastructure/FaultTolerantRequest': {
          backgroundRequest: this.backgroundRequest
        },
        '../Errors/Errors': Errors,
        request: this.request,
        'logger-sharelatex': {
          log() {}
        }
      }
    })
  })

  describe('checkAnalyticsRequest', function() {
    it('ignores smoke test user', function(done) {
      this.settings.smokeTest = { userId: this.fakeUserId }
      this.AnalyticsManager.identifyUser(this.fakeUserId, '', error => {
        expect(error).to.not.exist
        sinon.assert.notCalled(this.request)
        done()
      })
    })

    it('return error if analytics service is not configured', function(done) {
      this.settings.apis.analytics = null
      this.AnalyticsManager.identifyUser(this.fakeUserId, '', error => {
        expect(error).to.be.instanceof(Errors.ServiceNotConfiguredError)
        sinon.assert.notCalled(this.request)
        done()
      })
    })
  })

  describe('makes correct request to analytics', function() {
    it('identifyUser', function(done) {
      const oldUserId = '456def'
      this.AnalyticsManager.identifyUser(this.fakeUserId, oldUserId, error => {
        expect(error).to.not.exist
        sinon.assert.calledWithMatch(this.backgroundRequest, {
          body: { old_user_id: oldUserId },
          url: 'analytics.test/user/123abc/identify'
        })
        done()
      })
    })

    it('recordEvent', function(done) {
      const event = 'fake-event'
      this.AnalyticsManager.recordEvent(this.fakeUserId, event, null, error => {
        expect(error).to.not.exist
        sinon.assert.calledWithMatch(this.backgroundRequest, {
          body: { event },
          qs: { fromV2: 1 },
          url: 'analytics.test/user/123abc/event',
          timeout: 30000,
          maxAttempts: 9,
          backoffBase: 3000,
          backoffMultiplier: 3
        })
        done()
      })
    })

    it('updateEditingSession', function(done) {
      const projectId = '789ghi'
      const countryCode = 'fr'
      this.AnalyticsManager.updateEditingSession(
        this.fakeUserId,
        projectId,
        countryCode,
        error => {
          expect(error).to.not.exist
          sinon.assert.calledWithMatch(this.backgroundRequest, {
            qs: { userId: this.fakeUserId, projectId, countryCode, fromV2: 1 },
            url: 'analytics.test/editingSession'
          })
          done()
        }
      )
    })

    it('getLastOccurrence', function(done) {
      const event = 'fake-event'
      this.AnalyticsManager.getLastOccurrence(this.fakeUserId, event, error => {
        expect(error).to.not.exist
        sinon.assert.calledWithMatch(this.request, {
          body: { event },
          url: 'analytics.test/user/123abc/event/last_occurrence'
        })
        done()
      })
    })
  })
})
