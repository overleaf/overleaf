const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')
const { assert } = require('chai')
const { ObjectId } = require('mongodb-legacy')

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
    this.analyticsAccountMappingQueue = {
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
          case 'analytics-account-mapping':
            return self.analyticsAccountMappingQueue
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
        new ObjectId(this.fakeUserId),
        undefined
      )
      sinon.assert.notCalled(this.Queues.createScheduledJob)
    })

    it('analyticsId is not a valid UUID', function () {
      this.AnalyticsManager.identifyUser(
        new ObjectId(this.fakeUserId),
        this.fakeUserId
      )
      sinon.assert.notCalled(this.Queues.createScheduledJob)
    })

    it('userId and analyticsId are the same Mongo ID', function () {
      this.AnalyticsManager.identifyUser(
        new ObjectId(this.fakeUserId),
        new ObjectId(this.fakeUserId)
      )
      sinon.assert.notCalled(this.Queues.createScheduledJob)
    })

    it('editing session segmentation is not valid', function () {
      this.AnalyticsManager.updateEditingSession(
        this.fakeUserId,
        '789ghi',
        'fr',
        { '<alert>': 'foo' }
      )
      sinon.assert.called(this.logger.info)
      sinon.assert.notCalled(this.analyticsEditingSessionQueue.add)
    })

    it('event is not valid', async function () {
      await this.AnalyticsManager.recordEventForUser(
        this.fakeUserId,
        'not an event!'
      )
      sinon.assert.called(this.logger.info)
      sinon.assert.notCalled(this.analyticsEventsQueue.add)
    })

    it('event segmentation is not valid', async function () {
      await this.AnalyticsManager.recordEventForUser(
        this.fakeUserId,
        'an_event',
        { 'not_a!': 'Valid Segmentation' }
      )
      sinon.assert.called(this.logger.info)
      sinon.assert.notCalled(this.analyticsEventsQueue.add)
    })

    it('user property name is not valid', async function () {
      await this.AnalyticsManager.setUserPropertyForUser(
        this.fakeUserId,
        'an invalid property',
        'a_value'
      )
      sinon.assert.called(this.logger.info)
      sinon.assert.notCalled(this.analyticsUserPropertiesQueue.add)
    })

    it('user property value is not valid', async function () {
      await this.AnalyticsManager.setUserPropertyForUser(
        this.fakeUserId,
        'a_property',
        'an invalid value'
      )
      sinon.assert.called(this.logger.info)
      sinon.assert.notCalled(this.analyticsUserPropertiesQueue.add)
    })
  })

  describe('queues the appropriate message for', function () {
    it('identifyUser', function () {
      const analyticsId = 'bd101c4c-722f-4204-9e2d-8303e5d9c120'
      this.AnalyticsManager.identifyUser(this.fakeUserId, analyticsId, true)
      sinon.assert.notCalled(this.logger.info)
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
      sinon.assert.notCalled(this.logger.info)
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
      sinon.assert.notCalled(this.logger.info)
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

    it('empty field in event segmentation', async function () {
      const timings = null
      await this.AnalyticsManager.recordEventForUser(
        this.fakeUserId,
        'an_event',
        { compileTime: timings?.compileE2E }
      )
      sinon.assert.notCalled(this.logger.info)
      sinon.assert.calledWithMatch(this.analyticsEventsQueue.add, 'event', {
        analyticsId: this.analyticsId,
        event: 'an_event',
        segmentation: { compileTime: undefined },
        isLoggedIn: true,
      })
    })

    it('empty space in event segmentation value', async function () {
      await this.AnalyticsManager.recordEventForUser(
        this.fakeUserId,
        'an_event',
        { segment: 'a value with spaces' }
      )
      sinon.assert.notCalled(this.logger.info)
      sinon.assert.calledWithMatch(this.analyticsEventsQueue.add, 'event', {
        analyticsId: this.analyticsId,
        event: 'an_event',
        segmentation: { segment: 'a value with spaces' },
        isLoggedIn: true,
      })
    })

    it('percent sign in event segmentation value', async function () {
      await this.AnalyticsManager.recordEventForUser(
        this.fakeUserId,
        'an_event',
        { segment: 'a value with escaped comma %2C' }
      )
      sinon.assert.notCalled(this.logger.info)
      sinon.assert.calledWithMatch(this.analyticsEventsQueue.add, 'event', {
        analyticsId: this.analyticsId,
        event: 'an_event',
        segmentation: { segment: 'a value with escaped comma %2C' },
        isLoggedIn: true,
      })
    })

    it('boolean field in event segmentation', async function () {
      await this.AnalyticsManager.recordEventForUser(
        this.fakeUserId,
        'an_event',
        { isAutoCompile: false }
      )
      sinon.assert.notCalled(this.logger.info)
      sinon.assert.calledWithMatch(this.analyticsEventsQueue.add, 'event', {
        analyticsId: this.analyticsId,
        event: 'an_event',
        segmentation: { isAutoCompile: false },
        isLoggedIn: true,
      })
    })

    it('account mapping', async function () {
      const message = {
        source: 'salesforce',
        sourceEntity: 'account',
        sourceEntityId: 'abc123abc123abc123',
        target: 'v1',
        targetEntity: 'university',
        targetEntityId: 1,
        createdAt: '2021-01-01T00:00:00Z',
      }
      await this.AnalyticsManager.registerAccountMapping(message)
      sinon.assert.calledWithMatch(
        this.analyticsAccountMappingQueue.add,
        'account-mapping',
        message
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
                case 'analytics-account-mapping':
                  return self.analyticsAccountMappingQueue
                default:
                  throw new Error('Unexpected queue name')
              }
            },
          },

          './UserAnalyticsIdCache': (this.UserAnalyticsIdCache = {
            get: sinon.stub().resolves(this.analyticsId),
          }),
          crypto: {
            randomUUID: () => this.analyticsId,
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
        () => {
          assert.equal(this.analyticsId, this.req.session.analyticsId)
        }
      )
    })

    it('sets session.analyticsId with a legacy user session without an analyticsId', async function () {
      this.UserAnalyticsIdCache.get.resolves(this.userId)
      this.req.session.user = {
        _id: this.userId,
        analyticsId: undefined,
      }
      await this.AnalyticsManager.analyticsIdMiddleware(
        this.req,
        this.res,
        () => {
          assert.equal(this.userId, this.req.session.analyticsId)
        }
      )
    })

    it('updates session.analyticsId with a legacy user session without an analyticsId if different', async function () {
      this.UserAnalyticsIdCache.get.resolves(this.userId)
      this.req.session.user = {
        _id: this.userId,
        analyticsId: undefined,
      }
      this.req.analyticsId = 'foo'
      this.AnalyticsManager.analyticsIdMiddleware(this.req, this.res, () => {
        assert.equal(this.userId, this.req.session.analyticsId)
      })
    })

    it('does not update session.analyticsId with a legacy user session without an analyticsId if same', async function () {
      this.UserAnalyticsIdCache.get.resolves(this.userId)
      this.req.session.user = {
        _id: this.userId,
        analyticsId: undefined,
      }
      this.req.analyticsId = this.userId
      await this.AnalyticsManager.analyticsIdMiddleware(
        this.req,
        this.res,
        () => {
          assert.equal(this.userId, this.req.session.analyticsId)
        }
      )
    })
  })
})
