const Path = require('path')
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { ObjectId } = require('mongodb')
const { expect } = require('chai')

const MODULE_PATH = Path.join(
  __dirname,
  '../../../../app/src/Features/SplitTests/SplitTestHandler'
)

describe('SplitTestHandler', function () {
  beforeEach(function () {
    this.splitTests = [
      makeSplitTest('active-test'),
      makeSplitTest('legacy-test'),
      makeSplitTest('no-analytics-test-1', { analyticsEnabled: false }),
      makeSplitTest('no-analytics-test-2', {
        analyticsEnabled: false,
        versionNumber: 2,
      }),
    ]

    this.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(null),
      },
    }

    this.SplitTest = {
      find: sinon.stub().returns({
        exec: sinon.stub().resolves(this.splitTests),
      }),
    }

    this.SplitTestCache = {
      get: sinon.stub().resolves(null),
    }
    for (const splitTest of this.splitTests) {
      this.SplitTestCache.get.withArgs(splitTest.name).resolves(splitTest)
    }

    this.SplitTestHandler = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '../User/UserGetter': this.UserGetter,
        './SplitTestCache': this.SplitTestCache,
        '../../models/SplitTest': { SplitTest: this.SplitTest },
        '../User/UserUpdater': {},
        '../Analytics/AnalyticsManager': {},
        './LocalsHelper': {},
      },
    })
  })

  describe('with an existing user', function () {
    beforeEach(async function () {
      this.user = {
        _id: ObjectId(),
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
      this.UserGetter.promises.getUser
        .withArgs(this.user._id)
        .resolves(this.user)
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
      const unknownUserId = ObjectId()
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
      this.user = { _id: ObjectId() }
      this.UserGetter.promises.getUser
        .withArgs(this.user._id)
        .resolves(this.user)
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
      })
    })
  })
})

function makeSplitTest(name, opts = {}) {
  const {
    active = true,
    analyticsEnabled = active,
    phase = 'release',
    versionNumber = 1,
  } = opts

  return {
    name,
    getCurrentVersion: sinon.stub().returns({
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
    }),
  }
}
