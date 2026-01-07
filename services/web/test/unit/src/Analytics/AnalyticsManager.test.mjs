import { vi, assert } from 'vitest'
import path from 'node:path'
import sinon from 'sinon'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'
import mongodb from 'mongodb-legacy'

const { ObjectId } = mongodb

const MODULE_PATH = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Analytics/AnalyticsManager'
)
vi.mock('../../../../app/src/infrastructure/Metrics.mjs', () => ({
  default: {
    analyticsQueue: {
      inc: vi.fn(),
    },
  },
}))

describe('AnalyticsManager', function () {
  beforeEach(async function (ctx) {
    ctx.fakeUserId = 'dbfc9438d14996f73dd172fb'
    ctx.analyticsId = 'ecdb935a-52f3-4f91-aebc-7a70d2ffbb55'
    ctx.Settings = {
      analytics: { enabled: true, hashedEmailSalt: 'salt' },
    }
    ctx.analyticsEventsQueue = {
      add: sinon.stub().resolves(),
      process: sinon.stub().resolves(),
    }
    ctx.analyticsEditingSessionQueue = {
      add: sinon.stub().resolves(),
      process: sinon.stub().resolves(),
    }
    ctx.onboardingEmailsQueue = {
      add: sinon.stub().resolves(),
      process: sinon.stub().resolves(),
    }
    ctx.analyticsUserPropertiesQueue = {
      add: sinon.stub().resolves(),
      process: sinon.stub().resolves(),
    }
    ctx.analyticsAccountMappingQueue = {
      add: sinon.stub().resolves(),
      process: sinon.stub().resolves(),
    }
    ctx.analyticsEmailChangeQueue = {
      add: sinon.stub().resolves(),
      process: sinon.stub().resolves(),
    }
    ctx.analyticsPackageUsageQueue = {
      add: sinon.stub().resolves(),
      process: sinon.stub().resolves(),
    }
    ctx.Queues = {
      getQueue: queueName => {
        switch (queueName) {
          case 'analytics-events':
            return ctx.analyticsEventsQueue
          case 'analytics-editing-sessions':
            return ctx.analyticsEditingSessionQueue
          case 'emails-onboarding':
            return ctx.onboardingEmailsQueue
          case 'analytics-user-properties':
            return ctx.analyticsUserPropertiesQueue
          case 'analytics-account-mapping':
            return ctx.analyticsAccountMappingQueue
          case 'analytics-email-change':
            return ctx.analyticsEmailChangeQueue
          case 'analytics-package-usage':
            return ctx.analyticsPackageUsageQueue
          default:
            throw new Error('Unexpected queue name')
        }
      },
      createScheduledJob: sinon.stub().resolves(),
    }
    ctx.backgroundRequest = sinon.stub().yields()
    ctx.request = sinon.stub().yields()

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.Settings,
    }))

    vi.doMock('../../../../app/src/infrastructure/Queues', () => ({
      default: ctx.Queues,
    }))

    vi.doMock(
      '../../../../app/src/Features/Analytics/UserAnalyticsIdCache',
      () => ({
        default: (ctx.UserAnalyticsIdCache = {
          get: sinon.stub().resolves(ctx.analyticsId),
        }),
      })
    )

    ctx.AnalyticsManager = (await import(MODULE_PATH)).default
  })

  describe('ignores when', function () {
    it('user is smoke test user', function (ctx) {
      ctx.Settings.smokeTest = { userId: ctx.fakeUserId }
      ctx.AnalyticsManager.identifyUser(ctx.fakeUserId, '')
      sinon.assert.notCalled(ctx.Queues.createScheduledJob)
    })

    it('analytics service is disabled', function (ctx) {
      ctx.Settings.analytics.enabled = false
      ctx.AnalyticsManager.identifyUser(ctx.fakeUserId, '')
      sinon.assert.notCalled(ctx.Queues.createScheduledJob)
    })

    it('userId is missing', function (ctx) {
      ctx.AnalyticsManager.identifyUser(undefined, ctx.analyticsId)
      sinon.assert.notCalled(ctx.Queues.createScheduledJob)
    })

    it('analyticsId is missing', function (ctx) {
      ctx.AnalyticsManager.identifyUser(new ObjectId(ctx.fakeUserId), undefined)
      sinon.assert.notCalled(ctx.Queues.createScheduledJob)
    })

    it('analyticsId is not a valid UUID', function (ctx) {
      ctx.AnalyticsManager.identifyUser(
        new ObjectId(ctx.fakeUserId),
        ctx.fakeUserId
      )
      sinon.assert.notCalled(ctx.Queues.createScheduledJob)
    })

    it('userId and analyticsId are the same Mongo ID', function (ctx) {
      ctx.AnalyticsManager.identifyUser(
        new ObjectId(ctx.fakeUserId),
        new ObjectId(ctx.fakeUserId)
      )
      sinon.assert.notCalled(ctx.Queues.createScheduledJob)
    })

    it('editing session segmentation is not valid', function (ctx) {
      ctx.AnalyticsManager.updateEditingSession(
        ctx.fakeUserId,
        '789ghi',
        'fr',
        { '<alert>': 'foo' }
      )
      expect(ctx.logger.info).toHaveBeenCalled()
      sinon.assert.notCalled(ctx.analyticsEditingSessionQueue.add)
    })

    it('event is not valid', async function (ctx) {
      await ctx.AnalyticsManager.recordEventForUser(
        ctx.fakeUserId,
        'not an event!'
      )
      expect(ctx.logger.info).toHaveBeenCalled()
      sinon.assert.notCalled(ctx.analyticsEventsQueue.add)
    })

    it('event segmentation is not valid', async function (ctx) {
      await ctx.AnalyticsManager.recordEventForUser(
        ctx.fakeUserId,
        'an_event',
        { 'not_a!': 'Valid Segmentation' }
      )
      expect(ctx.logger.info).toHaveBeenCalled()
      sinon.assert.notCalled(ctx.analyticsEventsQueue.add)
    })

    it('user property name is not valid', async function (ctx) {
      await ctx.AnalyticsManager.setUserPropertyForUser(
        ctx.fakeUserId,
        'an invalid property',
        'a_value'
      )
      expect(ctx.logger.info).toHaveBeenCalled()
      sinon.assert.notCalled(ctx.analyticsUserPropertiesQueue.add)
    })

    it('user property value is not valid', async function (ctx) {
      await ctx.AnalyticsManager.setUserPropertyForUser(
        ctx.fakeUserId,
        'a_property',
        'an invalid value'
      )
      expect(ctx.logger.info).toHaveBeenCalled()
      sinon.assert.notCalled(ctx.analyticsUserPropertiesQueue.add)
    })
  })

  describe('queues the appropriate message for', function () {
    it('identifyUser', function (ctx) {
      const analyticsId = 'bd101c4c-722f-4204-9e2d-8303e5d9c120'
      ctx.AnalyticsManager.identifyUser(ctx.fakeUserId, analyticsId, true)
      expect(ctx.logger.info).not.toHaveBeenCalled()
      sinon.assert.calledWithMatch(
        ctx.Queues.createScheduledJob,
        'analytics-events',
        {
          name: 'identify',
          data: {
            userId: ctx.fakeUserId,
            analyticsId,
            isNewUser: true,
            createdAt: sinon.match.date,
          },
        },
        60000
      )
    })

    it('recordEventForUser', async function (ctx) {
      const event = 'fake-event'
      await ctx.AnalyticsManager.recordEventForUser(ctx.fakeUserId, event, null)
      expect(ctx.logger.info).not.toHaveBeenCalled()
      sinon.assert.calledWithMatch(ctx.analyticsEventsQueue.add, 'event', {
        analyticsId: ctx.analyticsId,
        event,
        segmentation: null,
        isLoggedIn: true,
      })
    })

    it('updateEditingSession', function (ctx) {
      const projectId = '789ghi'
      const countryCode = 'fr'
      const segmentation = { editorType: 'abc' }
      ctx.AnalyticsManager.updateEditingSession(
        ctx.fakeUserId,
        projectId,
        countryCode,
        segmentation
      )
      expect(ctx.logger.info).not.toHaveBeenCalled()
      sinon.assert.calledWithMatch(
        ctx.analyticsEditingSessionQueue.add,
        'editing-session',
        {
          userId: ctx.fakeUserId,
          projectId,
          countryCode,
          segmentation,
        }
      )
    })

    it('empty field in event segmentation', async function (ctx) {
      const timings = null
      await ctx.AnalyticsManager.recordEventForUser(
        ctx.fakeUserId,
        'an_event',
        { compileTime: timings?.compileE2E }
      )
      expect(ctx.logger.info).not.toHaveBeenCalled()
      sinon.assert.calledWithMatch(ctx.analyticsEventsQueue.add, 'event', {
        analyticsId: ctx.analyticsId,
        event: 'an_event',
        segmentation: { compileTime: undefined },
        isLoggedIn: true,
      })
    })

    it('empty space in event segmentation value', async function (ctx) {
      await ctx.AnalyticsManager.recordEventForUser(
        ctx.fakeUserId,
        'an_event',
        { segment: 'a value with spaces' }
      )
      expect(ctx.logger.info).not.toHaveBeenCalled()
      sinon.assert.calledWithMatch(ctx.analyticsEventsQueue.add, 'event', {
        analyticsId: ctx.analyticsId,
        event: 'an_event',
        segmentation: { segment: 'a value with spaces' },
        isLoggedIn: true,
      })
    })

    it('percent sign in event segmentation value', async function (ctx) {
      await ctx.AnalyticsManager.recordEventForUser(
        ctx.fakeUserId,
        'an_event',
        { segment: 'a value with escaped comma %2C' }
      )
      expect(ctx.logger.info).not.toHaveBeenCalled()
      sinon.assert.calledWithMatch(ctx.analyticsEventsQueue.add, 'event', {
        analyticsId: ctx.analyticsId,
        event: 'an_event',
        segmentation: { segment: 'a value with escaped comma %2C' },
        isLoggedIn: true,
      })
    })

    it('boolean field in event segmentation', async function (ctx) {
      await ctx.AnalyticsManager.recordEventForUser(
        ctx.fakeUserId,
        'an_event',
        { isAutoCompile: false }
      )
      expect(ctx.logger.info).not.toHaveBeenCalled()
      sinon.assert.calledWithMatch(ctx.analyticsEventsQueue.add, 'event', {
        analyticsId: ctx.analyticsId,
        event: 'an_event',
        segmentation: { isAutoCompile: false },
        isLoggedIn: true,
      })
    })

    it('account mapping', async function (ctx) {
      const message = {
        source: 'salesforce',
        sourceEntity: 'account',
        sourceEntityId: 'abc123abc123abc123',
        target: 'v1',
        targetEntity: 'university',
        targetEntityId: 1,
        createdAt: '2021-01-01T00:00:00Z',
      }
      await ctx.AnalyticsManager.registerAccountMapping(message)
      sinon.assert.calledWithMatch(
        ctx.analyticsAccountMappingQueue.add,
        'account-mapping',
        message
      )
    })

    it('email change', async function (ctx) {
      const message = {
        userId: ctx.fakeUserId,
        email: 'test@example.com',
        createdAt: '2021-01-01T00:00:00Z',
        action: 'created',
        emailCreatedAt: '2021-01-01T00:00:00Z',
        isPrimary: false,
      }
      ctx.AnalyticsManager.registerEmailChange(message)
      const convertedMessage = {
        ...message,
        emailConfirmedAt: undefined,
        emailDeletedAt: undefined,
        email:
          '1778d425d64c5259ef7b574a2488647eb51ca739a0b16bfa0e2e3e16fff362db', // sha256 hash of email + salt
      }
      sinon.assert.calledWithMatch(
        ctx.analyticsEmailChangeQueue.add,
        'email-change',
        convertedMessage
      )
    })
  })

  describe('AnalyticsIdMiddleware', function () {
    beforeEach(async function (ctx) {
      vi.resetModules()
      ctx.userId = '123abc'
      ctx.analyticsId = 'bccd308c-5d72-426e-a106-662e88557795'

      vi.doMock('@overleaf/settings', () => ({
        default: {
          analytics: { hashedEmailSalt: 'test-salt' },
        },
      }))

      vi.doMock('../../../../app/src/infrastructure/Queues', () => ({
        default: {
          getQueue: queueName => {
            switch (queueName) {
              case 'analytics-events':
                return ctx.analyticsEventsQueue
              case 'analytics-editing-sessions':
                return ctx.analyticsEditingSessionQueue
              case 'emails-onboarding':
                return ctx.onboardingEmailsQueue
              case 'analytics-user-properties':
                return ctx.analyticsUserPropertiesQueue
              case 'analytics-account-mapping':
                return ctx.analyticsAccountMappingQueue
              case 'analytics-email-change':
                return ctx.analyticsEmailChangeQueue
              case 'analytics-package-usage':
                return ctx.analyticsPackageUsageQueue
              default:
                throw new Error('Unexpected queue name')
            }
          },
        },
      }))

      vi.doMock(
        '../../../../app/src/Features/Analytics/UserAnalyticsIdCache',
        () => ({
          default: (ctx.UserAnalyticsIdCache = {
            get: sinon.stub().resolves(ctx.analyticsId),
          }),
        })
      )

      vi.doMock('node:crypto', () => ({
        default: {
          randomUUID: () => ctx.analyticsId,
        },
      }))

      ctx.AnalyticsManager = (await import(MODULE_PATH)).default
      ctx.req = new MockRequest(vi)
      ctx.req.session = {}
      ctx.res = new MockResponse(vi)
      ctx.next = () => {}
    })

    it('sets session.analyticsId with no user in session', async function (ctx) {
      await ctx.AnalyticsManager.analyticsIdMiddleware(
        ctx.req,
        ctx.res,
        ctx.next
      )
      assert.equal(ctx.analyticsId, ctx.req.session.analyticsId)
    })

    it('does not update analyticsId when existing, with no user in session', async function (ctx) {
      ctx.req.session.analyticsId = 'foo'
      await ctx.AnalyticsManager.analyticsIdMiddleware(
        ctx.req,
        ctx.res,
        ctx.next
      )
      assert.equal('foo', ctx.req.session.analyticsId)
    })

    it('sets session.analyticsId with a logged in user in session having an analyticsId', async function (ctx) {
      ctx.req.session.user = {
        _id: ctx.userId,
        analyticsId: ctx.analyticsId,
      }
      await ctx.AnalyticsManager.analyticsIdMiddleware(ctx.req, ctx.res, () => {
        assert.equal(ctx.analyticsId, ctx.req.session.analyticsId)
      })
    })

    it('sets session.analyticsId with a legacy user session without an analyticsId', async function (ctx) {
      ctx.UserAnalyticsIdCache.get.resolves(ctx.userId)
      ctx.req.session.user = {
        _id: ctx.userId,
        analyticsId: undefined,
      }
      await ctx.AnalyticsManager.analyticsIdMiddleware(ctx.req, ctx.res, () => {
        assert.equal(ctx.userId, ctx.req.session.analyticsId)
      })
    })

    it('updates session.analyticsId with a legacy user session without an analyticsId if different', async function (ctx) {
      ctx.UserAnalyticsIdCache.get.resolves(ctx.userId)
      ctx.req.session.user = {
        _id: ctx.userId,
        analyticsId: undefined,
      }
      ctx.req.analyticsId = 'foo'
      ctx.AnalyticsManager.analyticsIdMiddleware(ctx.req, ctx.res, () => {
        assert.equal(ctx.userId, ctx.req.session.analyticsId)
      })
    })

    it('does not update session.analyticsId with a legacy user session without an analyticsId if same', async function (ctx) {
      ctx.UserAnalyticsIdCache.get.resolves(ctx.userId)
      ctx.req.session.user = {
        _id: ctx.userId,
        analyticsId: undefined,
      }
      ctx.req.analyticsId = ctx.userId
      await ctx.AnalyticsManager.analyticsIdMiddleware(ctx.req, ctx.res, () => {
        assert.equal(ctx.userId, ctx.req.session.analyticsId)
      })
    })
  })
})
