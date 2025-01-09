const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/src/Features/Helpers/AuthorizationHelper'

describe('AuthorizationHelper', function () {
  beforeEach(function () {
    this.AuthorizationHelper = SandboxedModule.require(modulePath, {
      requires: {
        './AdminAuthorizationHelper': (this.AdminAuthorizationHelper = {
          hasAdminAccess: sinon.stub().returns(false),
        }),
        '../../models/User': {
          UserSchema: {
            obj: {
              staffAccess: {
                publisherMetrics: {},
                publisherManagement: {},
                institutionMetrics: {},
                institutionManagement: {},
                groupMetrics: {},
                groupManagement: {},
                adminMetrics: {},
              },
            },
          },
        },
        '../Project/ProjectGetter': (this.ProjectGetter = { promises: {} }),
        '../SplitTests/SplitTestHandler': (this.SplitTestHandler = {
          promises: {},
        }),
      },
    })
  })

  describe('hasAnyStaffAccess', function () {
    it('with empty user', function () {
      const user = {}
      expect(this.AuthorizationHelper.hasAnyStaffAccess(user)).to.be.false
    })

    it('with no access user', function () {
      const user = { isAdmin: false, staffAccess: { adminMetrics: false } }
      expect(this.AuthorizationHelper.hasAnyStaffAccess(user)).to.be.false
    })

    it('with admin user', function () {
      const user = { isAdmin: true }
      this.AdminAuthorizationHelper.hasAdminAccess.returns(true)
      expect(this.AuthorizationHelper.hasAnyStaffAccess(user)).to.be.false
    })

    it('with staff user', function () {
      const user = { staffAccess: { adminMetrics: true, somethingElse: false } }
      this.AdminAuthorizationHelper.hasAdminAccess.returns(true)
      expect(this.AuthorizationHelper.hasAnyStaffAccess(user)).to.be.true
    })

    it('with non-staff user with extra attributes', function () {
      // make sure that staffAccess attributes not declared on the model don't
      // give user access
      const user = { staffAccess: { adminMetrics: false, somethingElse: true } }
      expect(this.AuthorizationHelper.hasAnyStaffAccess(user)).to.be.false
    })
  })

  describe('isReviewerRoleEnabled', function () {
    it('with no reviewers and no split test', async function () {
      this.ProjectGetter.promises.getProject = sinon.stub().resolves({
        reviewer_refs: {},
        owner_ref: 'ownerId',
      })
      this.SplitTestHandler.promises.getAssignmentForUser = sinon
        .stub()
        .resolves({
          variant: 'disabled',
        })
      expect(
        await this.AuthorizationHelper.promises.isReviewerRoleEnabled(
          'projectId'
        )
      ).to.be.false
    })

    it('with no reviewers and enabled split test', async function () {
      this.ProjectGetter.promises.getProject = sinon.stub().resolves({
        reviewer_refs: {},
        owner_ref: 'userId',
      })
      this.SplitTestHandler.promises.getAssignmentForUser = sinon
        .stub()
        .resolves({
          variant: 'enabled',
        })
      expect(
        await this.AuthorizationHelper.promises.isReviewerRoleEnabled(
          'projectId'
        )
      ).to.be.true
    })

    it('with reviewers and disabled split test', async function () {
      this.ProjectGetter.promises.getProject = sinon.stub().resolves({
        reviewer_refs: [{ $oid: 'userId' }],
      })
      this.SplitTestHandler.promises.getAssignmentForUser = sinon
        .stub()
        .resolves({
          variant: 'default',
        })
      expect(
        await this.AuthorizationHelper.promises.isReviewerRoleEnabled(
          'projectId'
        )
      ).to.be.true
    })

    it('with reviewers and enabled split test', async function () {
      this.ProjectGetter.promises.getProject = sinon.stub().resolves({
        reviewer_refs: [{ $oid: 'userId' }],
      })
      this.SplitTestHandler.promises.getAssignmentForUser = sinon
        .stub()
        .resolves({
          variant: 'enabled',
        })
      expect(
        await this.AuthorizationHelper.promises.isReviewerRoleEnabled(
          'projectId'
        )
      ).to.be.true
    })
  })
})
