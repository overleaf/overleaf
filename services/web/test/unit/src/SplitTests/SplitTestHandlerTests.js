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
    this.splitTest = {
      getCurrentVersion: sinon.stub().returns({ active: true }),
    }
    this.inactiveSplitTest = {
      getCurrentVersion: sinon.stub().returns({ active: false }),
    }

    this.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(null),
      },
    }

    this.SplitTestCache = {
      get: sinon.stub().resolves(null),
    }
    this.SplitTestCache.get.withArgs('legacy-test').resolves(this.splitTest)
    this.SplitTestCache.get.withArgs('other-test').resolves(this.splitTest)
    this.SplitTestCache.get
      .withArgs('inactive-test')
      .resolves(this.inactiveSplitTest)

    this.SplitTestHandler = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '../User/UserGetter': this.UserGetter,
        './SplitTestCache': this.SplitTestCache,
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
          'legacy-test': 'legacy-variant',
          'other-test': [
            { variantName: 'default', versionNumber: 1 },
            { variantName: 'latest', versionNumber: 3 },
            { variantName: 'experiment', versionNumber: 2 },
          ],
          'inactive-test': [{ variantName: 'trythis' }],
          'unknown-test': [{ variantName: 'trythis' }],
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
      expect(this.assignments).to.have.property('legacy-test')
      expect(this.assignments['legacy-test'].variantName).to.equal(
        'legacy-variant'
      )
    })

    it('returns the last assignment for each active test', function () {
      expect(this.assignments).to.have.property('other-test')
      expect(this.assignments['other-test'].variantName).to.equal('latest')
    })

    it('does not return assignments for inactive tests', function () {
      expect(this.assignments).not.to.have.property('inactive-test')
    })

    it('does not return assignments for unknown tests', function () {
      expect(this.assignments).not.to.have.property('unknown-test')
    })
  })

  describe('with an inexistent user', function () {
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

    it('returns empty assignments', function () {
      expect(this.assignments).to.deep.equal({})
    })
  })
})
