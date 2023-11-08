const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const { ObjectId } = require('mongodb')
const Errors = require('../../../../app/src/Features/Errors/Errors')

const MODULE_PATH = '../../../../app/src/Features/Subscription/GroupSSOHandler'

describe('GroupSSOHandler', function () {
  beforeEach(function () {
    this.user = { _id: new ObjectId(), enrollment: { sso: [] } }
    this.subscription = {
      _id: ObjectId().toString(),
      admin_id: new ObjectId(),
      member_ids: [this.user._id],
    }
    this.samlIdentifier = {
      externalUserId: 'user@external.com',
      userIdAttribute: 'email',
      providerId: `ol-group-subscription-id:${this.subscription._id.toString()}`,
    }
    this.auditLog = {
      initiatorId: 'test-initiator-id',
      ipAddress: '127.0.0.1',
    }
    this.ssoConfigData = {
      entryPoint: 'https://example.com/saml',
      certificates: ['abc'],
      signatureAlgorithm: 'sha256',
      userIdAttribute: 'nameId',
      enabled: true,
    }

    this.SSOConfig = {
      findById: sinon.stub().returns({
        exec: sinon.stub().resolves(this.ssoConfigData),
      }),
    }
    this.UserAuditLogHandler = {
      promises: {
        addEntry: sinon.stub().resolves(),
      },
    }
    this.UserUpdater = {
      promises: {
        updateUser: sinon.stub().resolves(),
      },
    }
    this.SAMLIdentityManager = {
      getUser: sinon.stub().resolves(),
    }
    this.User = {
      findOne: sinon.stub().returns({
        exec: sinon.stub().resolves(this.user),
      }),
    }
    this.GroupSSOHandler = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '../../models/SSOConfig': { SSOConfig: this.SSOConfig },
        '../User/UserAuditLogHandler': this.UserAuditLogHandler,
        '../User/UserUpdater': this.UserUpdater,
        '../User/SAMLIdentityManager': this.SAMLIdentityManager,
        '../../models/User': {
          User: this.User,
        },
      },
    })
  })

  describe('checkUserCanEnrollInSubscription', function () {
    it('should throw an error if the subscription is not found', async function () {
      this.SSOConfig.findById.returns({
        exec: sinon.stub().resolves(undefined),
      })
      await expect(
        this.GroupSSOHandler.promises.checkUserCanEnrollInSubscription(
          this.user._id,
          this.subscription
        )
      ).to.be.rejectedWith(Errors.SAMLGroupSSODisabledError)
    })

    it('should throw an error if SSO is not enabled for the group', async function () {
      const disabledSSOConfig = { ...this.ssoConfig, enabled: false }
      this.SSOConfig.findById.returns({
        exec: sinon.stub().resolves(disabledSSOConfig),
      })
      await expect(
        this.GroupSSOHandler.promises.checkUserCanEnrollInSubscription(
          this.user._id,
          this.subscription
        )
      ).to.be.rejectedWith(Errors.SAMLGroupSSODisabledError)
    })

    it('should throw an error if the user is not a member of the group', async function () {
      const testSubscription = {
        ...this.subscription,
        member_ids: [],
      }
      await expect(
        this.GroupSSOHandler.promises.checkUserCanEnrollInSubscription(
          this.user._id,
          testSubscription
        )
      ).to.be.rejectedWith(Errors.SAMLGroupSSOLoginIdentityNotFoundError)
    })

    it('should throw an error if the user is already enrolled to the group', async function () {
      const testUser = {
        ...this.user,
        enrollment: {
          sso: [{ groupId: this.subscription._id }],
        },
      }
      this.User.findOne.returns({
        exec: sinon.stub().resolves(testUser),
      })
      await expect(
        this.GroupSSOHandler.promises.checkUserCanEnrollInSubscription(
          this.user._id,
          this.subscription
        )
      ).to.be.rejectedWith(Errors.SAMLIdentityExistsError)
    })

    it('should resolve if the user can be enrolled to the group', async function () {
      await expect(
        this.GroupSSOHandler.promises.checkUserCanEnrollInSubscription(
          this.user._id,
          this.subscription
        )
      ).to.be.fulfilled
    })
  })

  describe('enrollInSubscription', function () {
    it('should throw an error if the user cannot be enrolled', async function () {
      const disabledSSOConfig = { ...this.ssoConfig, enabled: false }
      this.SSOConfig.findById.returns({
        exec: sinon.stub().resolves(disabledSSOConfig),
      })
      await expect(
        this.GroupSSOHandler.promises.enrollInSubscription(
          this.user._id,
          this.subscription,
          this.samlIdentifier.externalUserId,
          this.samlIdentifier.userIdAttribute,
          this.auditLog
        )
      ).to.be.rejectedWith(Errors.SAMLGroupSSODisabledError)
    })

    it('should throw an error if an identical SAML identity for the subscription/user already exists', async function () {
      this.SAMLIdentityManager.getUser.resolves(this.user)
      await expect(
        this.GroupSSOHandler.promises.enrollInSubscription(
          this.user._id,
          this.subscription,
          this.samlIdentifier.externalUserId,
          this.samlIdentifier.userIdAttribute,
          this.auditLog
        )
      ).to.be.rejectedWith(Errors.SAMLIdentityExistsError)
    })

    it("should add an entry the user's SSO enrollment and samlIdentifiers lists", async function () {
      await this.GroupSSOHandler.promises.enrollInSubscription(
        this.user._id,
        this.subscription,
        this.samlIdentifier.externalUserId,
        this.samlIdentifier.userIdAttribute,
        this.auditLog
      )
      expect(this.UserUpdater.promises.updateUser).to.have.been.calledWith(
        this.user._id,
        {
          $push: {
            samlIdentifiers: this.samlIdentifier,
            'enrollment.sso': {
              groupId: this.subscription._id,
              linkedAt: sinon.match.instanceOf(Date),
              primary: true,
            },
          },
        }
      )
    })

    it('should add an entry to the user audit log', async function () {
      await this.GroupSSOHandler.promises.enrollInSubscription(
        this.user._id,
        this.subscription,
        this.samlIdentifier.externalUserId,
        this.samlIdentifier.userIdAttribute,
        this.auditLog
      )
      expect(
        this.UserAuditLogHandler.promises.addEntry
      ).to.have.been.calledWith(
        this.user._id,
        'group-sso-link',
        this.auditLog.initiatorId,
        this.auditLog.ipAddress,
        this.samlIdentifier
      )
    })
  })
})
