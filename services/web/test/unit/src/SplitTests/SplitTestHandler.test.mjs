import { vi, assert, expect } from 'vitest'
import Path from 'node:path'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'

const { ObjectId } = mongodb

const MODULE_PATH = Path.join(
  import.meta.dirname,
  '../../../../app/src/Features/SplitTests/SplitTestHandler'
)

describe('SplitTestHandler', function () {
  let Features
  beforeEach(async function (ctx) {
    ctx.splitTests = [
      makeSplitTest('active-test', { versionNumber: 2 }),
      makeSplitTest('not-active-test', { active: false }),
      makeSplitTest('legacy-test'),
      makeSplitTest('no-analytics-test-1', { analyticsEnabled: false }),
      makeSplitTest('no-analytics-test-2', {
        analyticsEnabled: false,
        versionNumber: 2,
      }),
    ]
    ctx.cachedSplitTests = new Map()
    for (const splitTest of ctx.splitTests) {
      ctx.cachedSplitTests.set(splitTest.name, splitTest)
    }

    ctx.SplitTest = {
      find: sinon.stub().returns({
        exec: sinon.stub().resolves(ctx.splitTests),
      }),
    }

    ctx.SplitTestCache = {
      get: sinon.stub().resolves({}),
    }
    ctx.SplitTestCache.get.resolves(ctx.cachedSplitTests)
    ctx.Settings = {
      moduleImportSequence: [],
      overleaf: {},
      devToolbar: {
        enabled: false,
      },
    }
    ctx.AnalyticsManager = {
      getIdsFromSession: sinon.stub(),
      setUserPropertyForAnalyticsId: sinon.stub().resolves(),
    }
    ctx.LocalsHelper = {
      setSplitTestVariant: sinon.stub(),
      setSplitTestInfo: sinon.stub(),
    }
    ctx.SplitTestSessionHandler = {
      collectSessionStats: sinon.stub(),
      getCachedVariant: sinon.stub(),
      setVariantInCache: sinon.stub(),
    }
    ctx.SplitTestUserGetter = {
      promises: {
        getUser: sinon.stub().resolves(null),
      },
    }
    ctx.SessionManager = {
      isUserLoggedIn: sinon.stub().returns(false),
    }

    Features = {
      hasFeature: vi.fn().mockReturnValue(true),
    }

    vi.doMock('../../../../app/src/infrastructure/Features', () => ({
      default: Features,
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock('../../../../app/src/Features/SplitTests/SplitTestCache', () => ({
      default: ctx.SplitTestCache,
    }))

    vi.doMock('../../../../app/src/models/SplitTest', () => ({
      SplitTest: ctx.SplitTest,
    }))

    vi.doMock('../../../../app/src/Features/User/UserUpdater', () => ({
      default: {},
    }))

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({
        default: ctx.AnalyticsManager,
      })
    )

    vi.doMock('../../../../app/src/Features/SplitTests/LocalsHelper', () => ({
      default: ctx.LocalsHelper,
    }))

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestSessionHandler',
      () => ({
        default: ctx.SplitTestSessionHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestUserGetter',
      () => ({
        default: ctx.SplitTestUserGetter,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: ctx.SessionManager,
      })
    )

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.Settings,
    }))

    ctx.SplitTestHandler = (await import(MODULE_PATH)).default

    ctx.req = new MockRequest(vi)
    ctx.res = new MockResponse(vi)
  })

  describe('with an existing user', function () {
    beforeEach(async function (ctx) {
      ctx.user = {
        _id: new ObjectId(),
        splitTests: {
          'active-test': [
            {
              variantName: 'default',
              versionNumber: 1,
              assignedAt: 'active-test-assigned-at',
            },
          ],
          'legacy-test': 'legacy-variant',
          'inactive-test': [{ variantName: 'trythis' }],
          'unknown-test': [{ variantName: 'trythis' }],
          'no-analytics-test-2': [
            {
              variantName: 'some-variant',
              versionNumber: 1,
              assignedAt: 'no-analytics-assigned-at',
            },
          ],
        },
      }
      ctx.SplitTestUserGetter.promises.getUser.resolves(ctx.user)
      ctx.SessionManager.isUserLoggedIn.returns(true)
      ctx.assignments =
        await ctx.SplitTestHandler.promises.getActiveAssignmentsForUser(
          ctx.user._id
        )
      ctx.explicitAssignments =
        await ctx.SplitTestHandler.promises.getActiveAssignmentsForUser(
          ctx.user._id,
          false,
          true
        )
      ctx.assignedToActiveTest =
        await ctx.SplitTestHandler.promises.hasUserBeenAssignedToVariant(
          ctx.req,
          ctx.user._id,
          'active-test',
          'variant-1'
        )
      ctx.assignedToActiveTestAnyVersion =
        await ctx.SplitTestHandler.promises.hasUserBeenAssignedToVariant(
          ctx.req,
          ctx.user._id,
          'active-test',
          'variant-1',
          true
        )
    })

    it('handles the legacy assignment format', function (ctx) {
      expect(ctx.assignments['legacy-test']).to.deep.equal({
        variantName: 'variant-1',
        phase: 'release',
        versionNumber: 1,
      })
    })

    it('returns the current assignment for each active test', function (ctx) {
      expect(ctx.assignments['active-test']).to.deep.equal({
        variantName: 'variant-1',
        phase: 'release',
        versionNumber: 2,
      })
    })

    it('returns the explicit assignment for each active test', function (ctx) {
      expect(ctx.explicitAssignments['active-test']).to.deep.equal({
        variantName: 'variant-1',
        phase: 'release',
        versionNumber: 2,
        assignedAt: 'active-test-assigned-at',
      })
    })

    it('returns the current assignment for tests with analytics disabled', function (ctx) {
      expect(ctx.assignments['no-analytics-test-1']).to.deep.equal({
        variantName: 'variant-1',
        phase: 'release',
        versionNumber: 1,
      })
    })

    it('returns the current assignment for tests with analytics disabled that had previous assignments', function (ctx) {
      expect(ctx.assignments['no-analytics-test-2']).to.deep.equal({
        variantName: 'variant-1',
        phase: 'release',
        versionNumber: 2,
      })
    })

    it('shows user has been assigned to previous version of variant', function (ctx) {
      expect(ctx.assignedToActiveTestAnyVersion).to.be.true
    })

    it('shows user has not been explicitly assigned to current version of variant', function (ctx) {
      expect(ctx.assignedToActiveTest).to.be.false
    })

    it('does not return assignments for unknown tests', function (ctx) {
      expect(ctx.assignments).not.to.have.property('unknown-test')
    })
  })

  describe('with an non-existent user', function () {
    beforeEach(async function (ctx) {
      const unknownUserId = new ObjectId()
      ctx.assignments =
        await ctx.SplitTestHandler.promises.getActiveAssignmentsForUser(
          unknownUserId
        )
    })

    it('returns empty assignments', function (ctx) {
      expect(ctx.assignments).to.deep.equal({})
    })
  })

  describe('with a user without assignments', function () {
    beforeEach(async function (ctx) {
      ctx.user = { _id: new ObjectId() }
      ctx.SplitTestUserGetter.promises.getUser.resolves(ctx.user)
      ctx.assignments =
        await ctx.SplitTestHandler.promises.getActiveAssignmentsForUser(
          ctx.user._id
        )
      ctx.explicitAssignments =
        await ctx.SplitTestHandler.promises.getActiveAssignmentsForUser(
          ctx.user._id,
          false,
          true
        )
      ctx.assignedToActiveTest =
        await ctx.SplitTestHandler.promises.hasUserBeenAssignedToVariant(
          ctx.req,
          ctx.user._id,
          'active-test',
          'variant-1'
        )
    })

    it('returns current assignments', function (ctx) {
      expect(ctx.assignments).to.deep.equal({
        'active-test': {
          phase: 'release',
          variantName: 'variant-1',
          versionNumber: 2,
        },
        'legacy-test': {
          phase: 'release',
          variantName: 'variant-1',
          versionNumber: 1,
        },
        'no-analytics-test-1': {
          phase: 'release',
          variantName: 'variant-1',
          versionNumber: 1,
        },
        'no-analytics-test-2': {
          phase: 'release',
          variantName: 'variant-1',
          versionNumber: 2,
        },
      })
    })

    it('shows user not assigned to variant', function (ctx) {
      expect(ctx.assignedToActiveTest).to.be.false
    })
  })

  describe('with settings overrides', function () {
    beforeEach(function (ctx) {
      ctx.Settings.splitTestOverrides = {
        'my-test-name': 'foo-1',
      }
    })

    it('should not use the override when in SaaS mode', async function (ctx) {
      ctx.AnalyticsManager.getIdsFromSession.returns({
        userId: 'abc123abc123',
      })
      ctx.SplitTestCache.get.resolves(
        new Map([
          [
            'my-test-name',
            {
              name: 'my-test-name',
              versions: [
                {
                  versionNumber: 0,
                  active: true,
                  variants: [
                    {
                      name: '100-percent-variant',
                      rolloutPercent: 100,
                      rolloutStripes: [{ start: 0, end: 100 }],
                    },
                  ],
                },
              ],
            },
          ],
        ])
      )

      const assignment = await ctx.SplitTestHandler.promises.getAssignment(
        ctx.req,
        ctx.res,
        'my-test-name'
      )

      assert.equal('100-percent-variant', assignment.variant)
    })

    it('should use the override when not in SaaS mode', async function (ctx) {
      ctx.Settings.splitTestOverrides = {
        'my-test-name': 'foo-1',
      }
      ctx.Settings.overleaf = undefined
      Features.hasFeature.mockImplementation(function (feature) {
        return feature !== 'saas'
      })
      const assignment = await ctx.SplitTestHandler.promises.getAssignment(
        ctx.req,
        ctx.res,
        'my-test-name'
      )

      assert.equal('foo-1', assignment.variant)
    })

    it('should use default when not in SaaS mode and no override is provided', async function (ctx) {
      ctx.Settings.splitTestOverrides = {}
      ctx.Settings.overleaf = undefined

      const assignment = await ctx.SplitTestHandler.promises.getAssignment(
        ctx.req,
        ctx.res,
        'my-test-name'
      )

      assert.equal('default', assignment.variant)
    })
  })

  describe('save assignments to res.locals', function () {
    beforeEach(function (ctx) {
      ctx.AnalyticsManager.getIdsFromSession.returns({
        userId: 'abc123abc123',
      })
    })

    it('when in SaaS mode it should set the variant', async function (ctx) {
      await ctx.SplitTestHandler.promises.getAssignment(
        ctx.req,
        ctx.res,
        'active-test'
      )
      expect(ctx.LocalsHelper.setSplitTestVariant).to.have.been.calledWith(
        ctx.res.locals,
        'active-test',
        'variant-1'
      )
    })

    it('when not in SaaS mode it should set the default variant', async function (ctx) {
      Features.hasFeature.mockImplementation(function (feature) {
        return feature !== 'saas'
      })
      await ctx.SplitTestHandler.promises.getAssignment(
        ctx.req,
        ctx.res,
        'active-test'
      )
      expect(ctx.LocalsHelper.setSplitTestVariant).to.have.been.calledWith(
        ctx.res.locals,
        'active-test',
        'default'
      )
    })
  })

  describe('variant user limits', function () {
    beforeEach(function (ctx) {
      ctx.AnalyticsManager.getIdsFromSession.returns({
        userId: 'abc123abc123',
      })
      ctx.SplitTestUserGetter.promises.getUser.resolves({
        _id: new ObjectId('abc123abc123abc123abc123'),
        splitTests: {},
      })
    })

    it('should assign to variant when under limit', async function (ctx) {
      ctx.cachedSplitTests.set(
        'active-test',
        makeSplitTest('active-test', { userLimit: 100, userCount: 50 })
      )

      const assignment = await ctx.SplitTestHandler.promises.getAssignment(
        ctx.req,
        ctx.res,
        'active-test'
      )

      expect(assignment.variant).to.equal('variant-1')
    })

    it('should assign to default when limit reached', async function (ctx) {
      ctx.cachedSplitTests.set(
        'active-test',
        makeSplitTest('active-test', { userLimit: 100, userCount: 100 })
      )

      const assignment = await ctx.SplitTestHandler.promises.getAssignment(
        ctx.req,
        ctx.res,
        'active-test'
      )

      expect(assignment.variant).to.equal('default')
    })

    it('should not apply limits when no limit configured', async function (ctx) {
      const assignment = await ctx.SplitTestHandler.promises.getAssignment(
        ctx.req,
        ctx.res,
        'active-test'
      )

      expect(assignment.variant).to.equal('variant-1')
    })

    it('should allow already assigned users even when limit reached', async function (ctx) {
      ctx.cachedSplitTests.set(
        'active-test',
        makeSplitTest('active-test', { userLimit: 100, userCount: 100 })
      )
      ctx.SplitTestUserGetter.promises.getUser.resolves({
        _id: new ObjectId('abc123abc123abc123abc123'),
        splitTests: {
          'active-test': [
            {
              variantName: 'variant-1',
              versionNumber: 1,
              assignedAt: new Date(),
              phase: 'release',
            },
          ],
        },
      })

      const assignment = await ctx.SplitTestHandler.promises.getAssignment(
        ctx.req,
        ctx.res,
        'active-test'
      )

      expect(assignment.variant).to.equal('variant-1')
    })

    it('should assign to default if userCount is undefined', async function (ctx) {
      ctx.cachedSplitTests.set(
        'active-test',
        makeSplitTest('active-test', { userLimit: 100, userCount: undefined })
      )

      const assignment = await ctx.SplitTestHandler.promises.getAssignment(
        ctx.req,
        ctx.res,
        'active-test'
      )

      expect(assignment.variant).to.equal('default')
    })
  })
})

function makeSplitTest(
  name,
  {
    active = true,
    analyticsEnabled = active,
    phase = 'release',
    versionNumber = 1,
    userLimit = undefined,
    userCount = undefined,
  } = {}
) {
  const variant = {
    name: 'variant-1',
    rolloutPercent: 100,
    rolloutStripes: [{ start: 0, end: 100 }],
  }

  if (userLimit !== undefined) {
    variant.userLimit = userLimit
  }

  if (userCount !== undefined) {
    variant.userCount = userCount
  }

  return {
    name,
    versions: [
      {
        active,
        analyticsEnabled,
        phase,
        versionNumber,
        variants: [variant],
      },
    ],
  }
}
