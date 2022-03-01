const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')
const { assert } = require('chai')
const { ObjectID } = require('mongodb')

const MODULE_PATH = path.join(
  __dirname,
  '../../../../app/src/Features/Analytics/AnalyticsManager'
)

describe('AnalyticsManager', function () {
  beforeEach(function () {
    this.fakeUserId = 'dbfc9438d14996f73dd172fb'
    this.analyticsId = 'ecdb935a-52f3-4f91-aebc-7a70d2ffbb55'
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
      getQueue: queueName => {
        switch (queueName) {
          case 'analytics-events':
            return self.analyticsEventsQueue
          case 'analytics-editing-sessions':
            return self.analyticsEditingSessionQueue
          case 'emails-onboarding':
            return self.onboardingEmailsQueue
          case 'analytics-user-properties':
            return self.analyticsUserPropertiesQueue
          default:
            throw new Error('Unexpected queue name')
        }
      },
      createScheduledJob: sinon.stub().resolves(),
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
      sinon.assert.notCalled(this.Queues.createScheduledJob)
    })

    it('analytics service is disabled', function () {
      this.Settings.analytics.enabled = false
      this.AnalyticsManager.identifyUser(this.fakeUserId, '')
      sinon.assert.notCalled(this.Queues.createScheduledJob)
    })

    it('userId is missing', function () {
      this.AnalyticsManager.identifyUser(undefined, this.analyticsId)
      sinon.assert.notCalled(this.Queues.createScheduledJob)
    })

    it('analyticsId is missing', function () {
      this.AnalyticsManager.identifyUser(
        new ObjectID(this.fakeUserId),
        undefined
      )
      sinon.assert.notCalled(this.Queues.createScheduledJob)
    })

    it('analyticsId is not a valid UUID', function () {
      this.AnalyticsManager.identifyUser(
        new ObjectID(this.fakeUserId),
        this.fakeUserId
      )
      sinon.assert.notCalled(this.Queues.createScheduledJob)
    })

    it('userId and analyticsId are the same Mongo ID', function () {
      this.AnalyticsManager.identifyUser(
        new ObjectID(this.fakeUserId),
        new ObjectID(this.fakeUserId)
      )
      sinon.assert.notCalled(this.Queues.createScheduledJob)
    })
  })

  describe('queues the appropriate message for', function () {
    it('identifyUser', function () {
      const analyticsId = 'bd101c4c-722f-4204-9e2d-8303e5d9c120'
      this.AnalyticsManager.identifyUser(this.fakeUserId, analyticsId, true)
      sinon.assert.calledWithMatch(
        this.Queues.createScheduledJob,
        'analytics-events',
        {
          name: 'identify',
          data: {
            userId: this.fakeUserId,
            analyticsId,
            isNewUser: true,
            createdAt: sinon.match.date,
          },
        },
        60000
      )
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
      const segmentation = { editorType: 'abc' }
      this.AnalyticsManager.updateEditingSession(
        this.fakeUserId,
        projectId,
        countryCode,
        segmentation
      )
      sinon.assert.calledWithMatch(
        this.analyticsEditingSessionQueue.add,
        'editing-session',
        {
          userId: this.fakeUserId,
          projectId,
          countryCode,
          segmentation,
        }
      )
    })
  })

  describe('AnalyticsIdMiddleware', function () {
    beforeEach(function () {
      this.userId = '123abc'
      this.analyticsId = 'bccd308c-5d72-426e-a106-662e88557795'
      const self = this
      this.AnalyticsManager = SandboxedModule.require(MODULE_PATH, {
        requires: {
          '@overleaf/settings': {},
          '../../infrastructure/Queues': {
            getQueue: queueName => {
              switch (queueName) {
                case 'analytics-events':
                  return self.analyticsEventsQueue
                case 'analytics-editing-sessions':
                  return self.analyticsEditingSessionQueue
                case 'emails-onboarding':
                  return self.onboardingEmailsQueue
                case 'analytics-user-properties':
                  return self.analyticsUserPropertiesQueue
                default:
                  throw new Error('Unexpected queue name')
              }
            },
          },
          './UserAnalyticsIdCache': {},
          uuid: {
            v4: () => this.analyticsId,
          },
        },
      })
      this.req = new MockRequest()
      this.req.session = {}
      this.res = new MockResponse()
      this.next = () => {}
    })

    it('sets session.analyticsId with no user in session', async function () {
      await this.AnalyticsManager.analyticsIdMiddleware(
        this.req,
        this.res,
        this.next
      )
      assert.equal(this.analyticsId, this.req.session.analyticsId)
    })

    it('does not update analyticsId when existing, with no user in session', async function () {
      this.req.session.analyticsId = 'foo'
      await this.AnalyticsManager.analyticsIdMiddleware(
        this.req,
        this.res,
        this.next
      )
      assert.equal('foo', this.req.session.analyticsId)
    })

    it('sets session.analyticsId with a logged in user in session having an analyticsId', async function () {
      this.req.session.user = {
        _id: this.userId,
        analyticsId: this.analyticsId,
      }
      await this.AnalyticsManager.analyticsIdMiddleware(
        this.req,
        this.res,
        this.next
      )
      assert.equal(this.analyticsId, this.req.session.analyticsId)
    })

    it('sets session.analyticsId with a legacy user session without an analyticsId', async function () {
      this.req.session.user = {
        _id: this.userId,
        analyticsId: undefined,
      }
      await this.AnalyticsManager.analyticsIdMiddleware(
        this.req,
        this.res,
        this.next
      )
      assert.equal(this.userId, this.req.session.analyticsId)
    })

    it('updates session.analyticsId with a legacy user session without an analyticsId if different', async function () {
      this.req.session.user = {
        _id: this.userId,
        analyticsId: undefined,
      }
      this.req.analyticsId = 'foo'
      await this.AnalyticsManager.analyticsIdMiddleware(
        this.req,
        this.res,
        this.next
      )
      assert.equal(this.userId, this.req.session.analyticsId)
    })

    it('does not update session.analyticsId with a legacy user session without an analyticsId if same', async function () {
      this.req.session.user = {
        _id: this.userId,
        analyticsId: undefined,
      }
      this.req.analyticsId = this.userId
      await this.AnalyticsManager.analyticsIdMiddleware(
        this.req,
        this.res,
        this.next
      )
      assert.equal(this.userId, this.req.session.analyticsId)

      await this.AnalyticsManager.analyticsIdMiddleware(
        this.req,
        this.res,
        this.next
      )
      assert.equal(this.userId, this.req.session.analyticsId)
    })
  })
})
