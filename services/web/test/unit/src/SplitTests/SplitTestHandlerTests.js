const Path = require('path')
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { ObjectId } = require('mongodb-legacy')
const { assert, expect } = require('chai')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')

const MODULE_PATH = Path.join(
  __dirname,
  '../../../../app/src/Features/SplitTests/SplitTestHandler'
)

describe('SplitTestHandler', function () {
  beforeEach(function () {
    this.splitTests = [
      makeSplitTest('active-test'),
      makeSplitTest('not-active-test', { active: false }),
      makeSplitTest('legacy-test'),
      makeSplitTest('no-analytics-test-1', { analyticsEnabled: false }),
      makeSplitTest('no-analytics-test-2', {
        analyticsEnabled: false,
        versionNumber: 2,
      }),
    ]
    this.cachedSplitTests = new Map()
    for (const splitTest of this.splitTests) {
      this.cachedSplitTests.set(splitTest.name, splitTest)
    }

    this.SplitTest = {
      find: sinon.stub().returns({
        exec: sinon.stub().resolves(this.splitTests),
      }),
    }

    this.SplitTestCache = {
      get: sinon.stub().resolves({}),
    }
    this.SplitTestCache.get.resolves(this.cachedSplitTests)
    this.Settings = {
      moduleImportSequence: [],
      overleaf: {},
      devToolbar: {
        enabled: false,
      },
    }
    this.AnalyticsManager = {
      getIdsFromSession: sinon.stub(),
      setUserPropertyForAnalyticsId: sinon.stub().resolves(),
    }
    this.LocalsHelper = {
      setSplitTestVariant: sinon.stub(),
      setSplitTestInfo: sinon.stub(),
    }
    this.SplitTestSessionHandler = {
      collectSessionStats: sinon.stub(),
    }
    this.SplitTestUserGetter = {
      promises: {
        getUser: sinon.stub().resolves(null),
      },
    }

    this.SplitTestHandler = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '../User/UserGetter': this.UserGetter,
        './SplitTestCache': this.SplitTestCache,
        '../../models/SplitTest': { SplitTest: this.SplitTest },
        '../User/UserUpdater': {},
        '../Analytics/AnalyticsManager': this.AnalyticsManager,
        './LocalsHelper': this.LocalsHelper,
        './SplitTestSessionHandler': this.SplitTestSessionHandler,
        './SplitTestUserGetter': this.SplitTestUserGetter,
        '@overleaf/settings': this.Settings,
      },
    })

    this.req = new MockRequest()
    this.res = new MockResponse()
  })

  describe('with an existing user', function () {
    beforeEach(async function () {
      this.user = {
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
      this.SplitTestUserGetter.promises.getUser.resolves(this.user)
      this.assignments =
        await this.SplitTestHandler.promises.getActiveAssignmentsForUser(
          this.user._id
        )
    })

    it('handles the legacy assignment format', function () {
      expect(this.assignments['legacy-test']).to.deep.equal({
        variantName: 'variant-1',
        phase: 'release',
        versionNumber: 1,
      })
    })

    it('returns the current assignment for each active test', function () {
      expect(this.assignments['active-test']).to.deep.equal({
        variantName: 'variant-1',
        phase: 'release',
        versionNumber: 1,
        assignedAt: 'active-test-assigned-at',
      })
    })

    it('returns the current assignment for tests with analytics disabled', function () {
      expect(this.assignments['no-analytics-test-1']).to.deep.equal({
        variantName: 'variant-1',
        phase: 'release',
        versionNumber: 1,
      })
    })

    it('returns the current assignment for tests with analytics disabled that had previous assignments', function () {
      expect(this.assignments['no-analytics-test-2']).to.deep.equal({
        variantName: 'variant-1',
        phase: 'release',
        versionNumber: 2,
      })
    })

    it('does not return assignments for unknown tests', function () {
      expect(this.assignments).not.to.have.property('unknown-test')
    })
  })

  describe('with an non-existent user', function () {
    beforeEach(async function () {
      const unknownUserId = new ObjectId()
      this.assignments =
        await this.SplitTestHandler.promises.getActiveAssignmentsForUser(
          unknownUserId
        )
    })

    it('returns empty assignments', function () {
      expect(this.assignments).to.deep.equal({})
    })
  })

  describe('with a user without assignments', function () {
    beforeEach(async function () {
      this.user = { _id: new ObjectId() }
      this.SplitTestUserGetter.promises.getUser.resolves(this.user)
      this.assignments =
        await this.SplitTestHandler.promises.getActiveAssignmentsForUser(
          this.user._id
        )
    })

    it('returns current assignments', function () {
      expect(this.assignments).to.deep.equal({
        'active-test': {
          phase: 'release',
          variantName: 'variant-1',
          versionNumber: 1,
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
        'not-active-test': {
          phase: 'release',
          variantName: 'variant-1',
          versionNumber: 1,
        },
      })
    })
  })

  describe('with settings overrides', function () {
    beforeEach(function () {
      this.Settings.splitTestOverrides = {
        'my-test-name': 'foo-1',
      }
    })

    it('should not use the override when in SaaS mode', async function () {
      this.AnalyticsManager.getIdsFromSession.returns({
        userId: 'abc123abc123',
      })
      this.SplitTestCache.get.resolves(
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

      const assignment = await this.SplitTestHandler.promises.getAssignment(
        this.req,
        this.res,
        'my-test-name'
      )

      assert.equal('100-percent-variant', assignment.variant)
    })

    it('should use the override when not in SaaS mode', async function () {
      this.Settings.splitTestOverrides = {
        'my-test-name': 'foo-1',
      }
      this.Settings.overleaf = undefined

      const assignment = await this.SplitTestHandler.promises.getAssignment(
        this.req,
        this.res,
        'my-test-name'
      )

      assert.equal('foo-1', assignment.variant)
    })

    it('should use default when not in SaaS mode and no override is provided', async function () {
      this.Settings.splitTestOverrides = {}
      this.Settings.overleaf = undefined

      const assignment = await this.SplitTestHandler.promises.getAssignment(
        this.req,
        this.res,
        'my-test-name'
      )

      assert.equal('default', assignment.variant)
    })
  })

  describe('save assignments to res.locals', function () {
    beforeEach(function () {
      this.AnalyticsManager.getIdsFromSession.returns({
        userId: 'abc123abc123',
      })
    })

    it('when in SaaS mode it should set the variant', async function () {
      await this.SplitTestHandler.promises.getAssignment(
        this.req,
        this.res,
        'active-test'
      )
      expect(this.LocalsHelper.setSplitTestVariant).to.have.been.calledWith(
        this.res.locals,
        'active-test',
        'variant-1'
      )
    })

    it('when not in SaaS mode it should set the default variant', async function () {
      this.Settings.overleaf = undefined
      await this.SplitTestHandler.promises.getAssignment(
        this.req,
        this.res,
        'active-test'
      )
      expect(this.LocalsHelper.setSplitTestVariant).to.have.been.calledWith(
        this.res.locals,
        'active-test',
        'default'
      )
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
  } = {}
) {
  return {
    name,
    versions: [
      {
        active,
        analyticsEnabled,
        phase,
        versionNumber,
        variants: [
          {
            name: 'variant-1',
            rolloutPercent: 100,
            rolloutStripes: [{ start: 0, end: 100 }],
          },
        ],
      },
    ],
  }
}
