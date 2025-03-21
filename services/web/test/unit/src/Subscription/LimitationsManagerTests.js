const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Subscription/LimitationsManager'
)

describe('LimitationsManager', function () {
  beforeEach(function () {
    this.user = {
      _id: (this.userId = 'user-id'),
      features: { collaborators: 1 },
    }
    this.project = {
      _id: (this.projectId = 'project-id'),
      owner_ref: this.userId,
    }
    this.ProjectGetter = {
      promises: {
        getProject: sinon.stub().callsFake(async (projectId, fields) => {
          if (projectId === this.projectId) {
            return this.project
          } else {
            return null
          }
        }),
      },
    }
    this.UserGetter = {
      promises: {
        getUser: sinon.stub().callsFake(async (userId, filter) => {
          if (userId === this.userId) {
            return this.user
          } else {
            return null
          }
        }),
      },
    }

    this.SubscriptionLocator = {
      promises: {
        getUsersSubscription: sinon.stub().resolves(),
        getSubscription: sinon.stub().resolves(),
        getMemberSubscriptions: sinon.stub().resolves(),
      },
    }

    this.CollaboratorsGetter = {
      promises: {
        getInvitedEditCollaboratorCount: sinon.stub().resolves(0),
        getMemberIdPrivilegeLevel: sinon.stub(),
      },
    }

    this.CollaboratorsInviteGetter = {
      promises: {
        getEditInviteCount: sinon.stub().resolves(0),
      },
    }

    this.LimitationsManager = SandboxedModule.require(modulePath, {
      requires: {
        '../Project/ProjectGetter': this.ProjectGetter,
        '../User/UserGetter': this.UserGetter,
        './SubscriptionLocator': this.SubscriptionLocator,
        '@overleaf/settings': (this.Settings = {}),
        '../Collaborators/CollaboratorsGetter': this.CollaboratorsGetter,
        '../Collaborators/CollaboratorsInviteGetter':
          this.CollaboratorsInviteGetter,
        './V1SubscriptionManager': this.V1SubscriptionManager,
      },
    })
  })

  describe('allowedNumberOfCollaboratorsInProject', function () {
    describe('when the project is owned by a user without a subscription', function () {
      beforeEach(function () {
        this.Settings.defaultFeatures = { collaborators: 23 }
        this.project.owner_ref = this.userId
        delete this.user.features
      })

      it('should return the default number', async function () {
        const result =
          await this.LimitationsManager.promises.allowedNumberOfCollaboratorsInProject(
            this.projectId
          )
        expect(result).to.equal(this.Settings.defaultFeatures.collaborators)
      })
    })

    describe('when the project is owned by a user with a subscription', function () {
      beforeEach(function () {
        this.project.owner_ref = this.userId
        this.user.features = { collaborators: 21 }
      })

      it('should return the number of collaborators the user is allowed', async function () {
        const result =
          await this.LimitationsManager.promises.allowedNumberOfCollaboratorsInProject(
            this.projectId
          )
        expect(result).to.equal(this.user.features.collaborators)
      })
    })
  })

  describe('allowedNumberOfCollaboratorsForUser', function () {
    describe('when the user has no features', function () {
      beforeEach(function () {
        this.Settings.defaultFeatures = { collaborators: 23 }
        delete this.user.features
      })

      it('should return the default number', async function () {
        const result =
          await this.LimitationsManager.promises.allowedNumberOfCollaboratorsForUser(
            this.userId
          )
        expect(result).to.equal(this.Settings.defaultFeatures.collaborators)
      })
    })

    describe('when the user has features', function () {
      beforeEach(async function () {
        this.user.features = { collaborators: 21 }
        this.result =
          await this.LimitationsManager.promises.allowedNumberOfCollaboratorsForUser(
            this.userId
          )
      })

      it('should return the number of collaborators the user is allowed', function () {
        expect(this.result).to.equal(this.user.features.collaborators)
      })
    })
  })

  describe('canAcceptEditCollaboratorInvite', function () {
    describe('when the project has fewer collaborators than allowed', function () {
      beforeEach(function () {
        this.current_number = 1
        this.user.features.collaborators = 2
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount =
          sinon.stub().resolves(this.current_number)
      })

      it('should return true', async function () {
        const result =
          await this.LimitationsManager.promises.canAcceptEditCollaboratorInvite(
            this.projectId
          )
        expect(result).to.be.true
      })
    })

    describe('when accepting the invite would exceed the collaborator limit', function () {
      beforeEach(function () {
        this.current_number = 2
        this.user.features.collaborators = 2
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount =
          sinon.stub().resolves(this.current_number)
      })

      it('should return false', async function () {
        const result =
          await this.LimitationsManager.promises.canAcceptEditCollaboratorInvite(
            this.projectId
          )
        expect(result).to.be.false
      })
    })

    describe('when the project has more collaborators than allowed', function () {
      beforeEach(function () {
        this.current_number = 3
        this.user.features.collaborators = 2
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount =
          sinon.stub().resolves(this.current_number)
      })

      it('should return false', async function () {
        const result =
          await this.LimitationsManager.promises.canAcceptEditCollaboratorInvite(
            this.projectId
          )
        expect(result).to.be.false
      })
    })

    describe('when the project has infinite collaborators', function () {
      beforeEach(function () {
        this.current_number = 100
        this.user.features.collaborators = -1
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount =
          sinon.stub().resolves(this.current_number)
      })

      it('should return true', async function () {
        const result =
          await this.LimitationsManager.promises.canAcceptEditCollaboratorInvite(
            this.projectId
          )
        expect(result).to.be.true
      })
    })
  })

  describe('canAddXEditCollaborators', function () {
    describe('when the project has fewer collaborators than allowed', function () {
      beforeEach(function () {
        this.current_number = 1
        this.user.features.collaborators = 2
        this.invite_count = 0
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount =
          sinon.stub().resolves(this.current_number)
        this.CollaboratorsInviteGetter.promises.getEditInviteCount = sinon
          .stub()
          .resolves(this.invite_count)
      })

      it('should return true', async function () {
        const result =
          await this.LimitationsManager.promises.canAddXEditCollaborators(
            this.projectId,
            1
          )
        expect(result).to.be.true
      })
    })

    describe('when the project has fewer collaborators and invites than allowed', function () {
      beforeEach(function () {
        this.current_number = 1
        this.user.features.collaborators = 4
        this.invite_count = 1
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount =
          sinon.stub().resolves(this.current_number)
        this.CollaboratorsInviteGetter.promises.getEditInviteCount = sinon
          .stub()
          .resolves(this.invite_count)
      })

      it('should return true', async function () {
        const result =
          await this.LimitationsManager.promises.canAddXEditCollaborators(
            this.projectId,
            1
          )
        expect(result).to.be.true
      })
    })

    describe('when the project has fewer collaborators than allowed but I want to add more than allowed', function () {
      beforeEach(function () {
        this.current_number = 1
        this.user.features.collaborators = 2
        this.invite_count = 0
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount =
          sinon.stub().resolves(this.current_number)
        this.CollaboratorsInviteGetter.promises.getEditInviteCount = sinon
          .stub()
          .resolves(this.invite_count)
      })

      it('should return false', async function () {
        const result =
          await this.LimitationsManager.promises.canAddXEditCollaborators(
            this.projectId,
            2
          )
        expect(result).to.be.false
      })
    })

    describe('when the project has more collaborators than allowed', function () {
      beforeEach(function () {
        this.current_number = 3
        this.user.features.collaborators = 2
        this.invite_count = 0
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount =
          sinon.stub().resolves(this.current_number)
        this.CollaboratorsInviteGetter.promises.getEditInviteCount = sinon
          .stub()
          .resolves(this.invite_count)
      })

      it('should return false', async function () {
        const result =
          await this.LimitationsManager.promises.canAddXEditCollaborators(
            this.projectId,
            1
          )
        expect(result).to.be.false
      })
    })

    describe('when the project has infinite collaborators', function () {
      beforeEach(function () {
        this.current_number = 100
        this.user.features.collaborators = -1
        this.invite_count = 0
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount =
          sinon.stub().resolves(this.current_number)
        this.CollaboratorsInviteGetter.promises.getEditInviteCount = sinon
          .stub()
          .resolves(this.invite_count)
      })

      it('should return true', async function () {
        const result =
          await this.LimitationsManager.promises.canAddXEditCollaborators(
            this.projectId,
            1
          )
        expect(result).to.be.true
      })
    })

    describe('when the project has more invites than allowed', function () {
      beforeEach(function () {
        this.current_number = 0
        this.user.features.collaborators = 2
        this.invite_count = 2
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount =
          sinon.stub().resolves(this.current_number)
        this.CollaboratorsInviteGetter.promises.getEditInviteCount = sinon
          .stub()
          .resolves(this.invite_count)
      })

      it('should return false', async function () {
        const result =
          await this.LimitationsManager.promises.canAddXEditCollaborators(
            this.projectId,
            1
          )
        expect(result).to.be.false
      })
    })

    describe('when the project has more invites and collaborators than allowed', function () {
      beforeEach(function () {
        this.current_number = 1
        this.user.features.collaborators = 2
        this.invite_count = 1
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount =
          sinon.stub().resolves(this.current_number)
        this.CollaboratorsInviteGetter.promises.getEditInviteCount = sinon
          .stub()
          .resolves(this.invite_count)
      })

      it('should return false', async function () {
        const result =
          await this.LimitationsManager.promises.canAddXEditCollaborators(
            this.projectId,
            1
          )
        expect(result).to.be.false
      })
    })
  })

  describe('canChangeCollaboratorPrivilegeLevel', function () {
    beforeEach(function () {
      this.collaboratorId = 'collaborator-id'
      this.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel.resolves(
        'readOnly'
      )
    })

    describe("when the limit hasn't been reached", function () {
      it('accepts changing a viewer to an editor', async function () {
        const result =
          await this.LimitationsManager.promises.canChangeCollaboratorPrivilegeLevel(
            this.projectId,
            this.collaboratorId,
            'readAndWrite'
          )
        expect(result).to.be.true
      })
    })

    describe('when the limit has been reached', function () {
      beforeEach(function () {
        this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount.resolves(
          1
        )
      })

      it('accepts changing a reviewer to an editor', async function () {
        this.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel.resolves(
          'review'
        )
        const result =
          await this.LimitationsManager.promises.canChangeCollaboratorPrivilegeLevel(
            this.projectId,
            this.collaboratorId,
            'readAndWrite'
          )
        expect(result).to.be.true
      })

      it('rejects changing a viewer to a reviewer', async function () {
        const result =
          await this.LimitationsManager.promises.canChangeCollaboratorPrivilegeLevel(
            this.projectId,
            this.collaboratorId,
            'review'
          )
        expect(result).to.be.false
      })
    })
  })

  describe('userHasSubscription', function () {
    beforeEach(function () {
      this.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves()
    })

    it('should return true if the recurly token is set', async function () {
      this.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves({
          recurlySubscription_id: '1234',
        })
      const { hasSubscription } =
        await this.LimitationsManager.promises.userHasSubscription(this.user)
      expect(hasSubscription).to.be.true
    })

    it('should return false if the recurly token is not set', async function () {
      this.SubscriptionLocator.promises.getUsersSubscription.resolves({})
      const { hasSubscription } =
        await this.LimitationsManager.promises.userHasSubscription(this.user)
      expect(hasSubscription).to.be.false
    })

    it('should return false if the subscription is undefined', async function () {
      this.SubscriptionLocator.promises.getUsersSubscription.resolves()
      const { hasSubscription } =
        await this.LimitationsManager.promises.userHasSubscription(this.user)
      expect(hasSubscription).to.be.false
    })

    it('should return the subscription', async function () {
      const stubbedSubscription = { freeTrial: {}, token: '' }
      this.SubscriptionLocator.promises.getUsersSubscription.resolves(
        stubbedSubscription
      )
      const { subscription } =
        await this.LimitationsManager.promises.userHasSubscription(this.user)
      expect(subscription).to.deep.equal(stubbedSubscription)
    })

    describe('when user has a custom account', function () {
      beforeEach(function () {
        this.fakeSubscription = { customAccount: true }
        this.SubscriptionLocator.promises.getUsersSubscription.resolves(
          this.fakeSubscription
        )
      })

      it('should return true', async function () {
        const { hasSubscription } =
          await this.LimitationsManager.promises.userHasSubscription(this.user)
        expect(hasSubscription).to.be.true
      })

      it('should return the subscription', async function () {
        const { subscription } =
          await this.LimitationsManager.promises.userHasSubscription(this.user)
        expect(subscription).to.deep.equal(this.fakeSubscription)
      })
    })
  })

  describe('userIsMemberOfGroupSubscription', function () {
    beforeEach(function () {
      this.SubscriptionLocator.promises.getMemberSubscriptions = sinon
        .stub()
        .resolves()
    })

    it('should return false if there are no groups subcriptions', async function () {
      this.SubscriptionLocator.promises.getMemberSubscriptions.resolves([])
      const { isMember } =
        await this.LimitationsManager.promises.userIsMemberOfGroupSubscription(
          this.user
        )
      expect(isMember).to.be.false
    })

    it('should return true if there are no groups subcriptions', async function () {
      const subscriptions = ['mock-subscription']
      this.SubscriptionLocator.promises.getMemberSubscriptions.resolves(
        subscriptions
      )
      const { isMember, subscriptions: retSubscriptions } =
        await this.LimitationsManager.promises.userIsMemberOfGroupSubscription(
          this.user
        )
      expect(isMember).to.be.true
      expect(retSubscriptions).to.deep.equal(subscriptions)
    })
  })

  describe('hasPaidSubscription', function () {
    beforeEach(function () {
      this.SubscriptionLocator.promises.getMemberSubscriptions = sinon
        .stub()
        .resolves([])
      this.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves(null)
    })

    it('should return true if userIsMemberOfGroupSubscription', async function () {
      this.SubscriptionLocator.promises.getMemberSubscriptions = sinon
        .stub()
        .resolves([{ _id: '123' }])
      const { hasPaidSubscription } =
        await this.LimitationsManager.promises.hasPaidSubscription(this.user)
      expect(hasPaidSubscription).to.be.true
    })

    it('should return true if userHasSubscription', async function () {
      this.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves({ recurlySubscription_id: '123' })
      const { hasPaidSubscription } =
        await this.LimitationsManager.promises.hasPaidSubscription(this.user)
      expect(hasPaidSubscription).to.be.true
    })

    it('should return false if none are true', async function () {
      const { hasPaidSubscription } =
        await this.LimitationsManager.promises.hasPaidSubscription(this.user)
      expect(hasPaidSubscription).to.be.false
    })

    it('should have userHasSubscriptionOrIsGroupMember alias', async function () {
      const { hasPaidSubscription } =
        await this.LimitationsManager.promises.userHasSubscriptionOrIsGroupMember(
          this.user
        )
      expect(hasPaidSubscription).to.be.false
    })
  })

  describe('hasGroupMembersLimitReached', function () {
    beforeEach(function () {
      this.subscriptionId = '12312'
      this.subscription = {
        membersLimit: 3,
        member_ids: ['', ''],
        teamInvites: [
          { email: 'bob@example.com', sentAt: new Date(), token: 'hey' },
        ],
      }
    })

    it('should return true if the limit is hit (including members and invites)', async function () {
      this.SubscriptionLocator.promises.getSubscription.resolves(
        this.subscription
      )
      const { limitReached } =
        await this.LimitationsManager.promises.hasGroupMembersLimitReached(
          this.subscriptionId
        )
      expect(limitReached).to.be.true
    })

    it('should return false if the limit is not hit (including members and invites)', async function () {
      this.subscription.membersLimit = 4
      this.SubscriptionLocator.promises.getSubscription.resolves(
        this.subscription
      )
      const { limitReached } =
        await this.LimitationsManager.promises.hasGroupMembersLimitReached(
          this.subscriptionId
        )
      expect(limitReached).to.be.false
    })

    it('should return true if the limit has been exceded (including members and invites)', async function () {
      this.subscription.membersLimit = 2
      this.SubscriptionLocator.promises.getSubscription.resolves(
        this.subscription
      )
      const { limitReached } =
        await this.LimitationsManager.promises.hasGroupMembersLimitReached(
          this.subscriptionId
        )
      expect(limitReached).to.be.true
    })
  })
})
