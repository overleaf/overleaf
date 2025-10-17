import { vi, expect } from 'vitest'
import sinon from 'sinon'
const modulePath =
  '../../../../app/src/Features/Subscription/LimitationsManager'

describe('LimitationsManager', function () {
  beforeEach(async function (ctx) {
    ctx.user = {
      _id: (ctx.userId = 'user-id'),
      features: { collaborators: 1 },
    }
    ctx.project = {
      _id: (ctx.projectId = 'project-id'),
      owner_ref: ctx.userId,
    }
    ctx.ProjectGetter = {
      promises: {
        getProject: sinon.stub().callsFake(async (projectId, fields) => {
          if (projectId === ctx.projectId) {
            return ctx.project
          } else {
            return null
          }
        }),
      },
    }
    ctx.UserGetter = {
      promises: {
        getUser: sinon.stub().callsFake(async (userId, filter) => {
          if (userId === ctx.userId) {
            return ctx.user
          } else {
            return null
          }
        }),
      },
    }

    ctx.SubscriptionLocator = {
      promises: {
        getUsersSubscription: sinon.stub().resolves(),
        getSubscription: sinon.stub().resolves(),
        getMemberSubscriptions: sinon.stub().resolves(),
      },
    }

    ctx.CollaboratorsGetter = {
      promises: {
        getInvitedEditCollaboratorCount: sinon.stub().resolves(0),
        getMemberIdPrivilegeLevel: sinon.stub(),
      },
    }

    ctx.CollaboratorsInviteGetter = {
      promises: {
        getEditInviteCount: sinon.stub().resolves(0),
      },
    }

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionLocator',
      () => ({
        default: ctx.SubscriptionLocator,
      })
    )

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.Settings = {}),
    }))

    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsGetter',
      () => ({
        default: ctx.CollaboratorsGetter,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsInviteGetter',
      () => ({
        default: ctx.CollaboratorsInviteGetter,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/V1SubscriptionManager',
      () => ({
        default: ctx.V1SubscriptionManager,
      })
    )

    ctx.LimitationsManager = (await import(modulePath)).default
  })

  describe('allowedNumberOfCollaboratorsInProject', function () {
    describe('when the project is owned by a user without a subscription', function () {
      beforeEach(function (ctx) {
        ctx.Settings.defaultFeatures = { collaborators: 23 }
        ctx.project.owner_ref = ctx.userId
        delete ctx.user.features
      })

      it('should return the default number', async function (ctx) {
        const result =
          await ctx.LimitationsManager.promises.allowedNumberOfCollaboratorsInProject(
            ctx.projectId
          )
        expect(result).to.equal(ctx.Settings.defaultFeatures.collaborators)
      })
    })

    describe('when the project is owned by a user with a subscription', function () {
      beforeEach(function (ctx) {
        ctx.project.owner_ref = ctx.userId
        ctx.user.features = { collaborators: 21 }
      })

      it('should return the number of collaborators the user is allowed', async function (ctx) {
        const result =
          await ctx.LimitationsManager.promises.allowedNumberOfCollaboratorsInProject(
            ctx.projectId
          )
        expect(result).to.equal(ctx.user.features.collaborators)
      })
    })
  })

  describe('allowedNumberOfCollaboratorsForUser', function () {
    describe('when the user has no features', function () {
      beforeEach(function (ctx) {
        ctx.Settings.defaultFeatures = { collaborators: 23 }
        delete ctx.user.features
      })

      it('should return the default number', async function (ctx) {
        const result =
          await ctx.LimitationsManager.promises.allowedNumberOfCollaboratorsForUser(
            ctx.userId
          )
        expect(result).to.equal(ctx.Settings.defaultFeatures.collaborators)
      })
    })

    describe('when the user has features', function () {
      beforeEach(async function (ctx) {
        ctx.user.features = { collaborators: 21 }
        ctx.result =
          await ctx.LimitationsManager.promises.allowedNumberOfCollaboratorsForUser(
            ctx.userId
          )
      })

      it('should return the number of collaborators the user is allowed', function (ctx) {
        expect(ctx.result).to.equal(ctx.user.features.collaborators)
      })
    })
  })

  describe('canAcceptEditCollaboratorInvite', function () {
    describe('when the project has fewer collaborators than allowed', function () {
      beforeEach(function (ctx) {
        ctx.current_number = 1
        ctx.user.features.collaborators = 2
        ctx.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount = sinon
          .stub()
          .resolves(ctx.current_number)
      })

      it('should return true', async function (ctx) {
        const result =
          await ctx.LimitationsManager.promises.canAcceptEditCollaboratorInvite(
            ctx.projectId
          )
        expect(result).to.be.true
      })
    })

    describe('when accepting the invite would exceed the collaborator limit', function () {
      beforeEach(function (ctx) {
        ctx.current_number = 2
        ctx.user.features.collaborators = 2
        ctx.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount = sinon
          .stub()
          .resolves(ctx.current_number)
      })

      it('should return false', async function (ctx) {
        const result =
          await ctx.LimitationsManager.promises.canAcceptEditCollaboratorInvite(
            ctx.projectId
          )
        expect(result).to.be.false
      })
    })

    describe('when the project has more collaborators than allowed', function () {
      beforeEach(function (ctx) {
        ctx.current_number = 3
        ctx.user.features.collaborators = 2
        ctx.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount = sinon
          .stub()
          .resolves(ctx.current_number)
      })

      it('should return false', async function (ctx) {
        const result =
          await ctx.LimitationsManager.promises.canAcceptEditCollaboratorInvite(
            ctx.projectId
          )
        expect(result).to.be.false
      })
    })

    describe('when the project has infinite collaborators', function () {
      beforeEach(function (ctx) {
        ctx.current_number = 100
        ctx.user.features.collaborators = -1
        ctx.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount = sinon
          .stub()
          .resolves(ctx.current_number)
      })

      it('should return true', async function (ctx) {
        const result =
          await ctx.LimitationsManager.promises.canAcceptEditCollaboratorInvite(
            ctx.projectId
          )
        expect(result).to.be.true
      })
    })
  })

  describe('canAddXEditCollaborators', function () {
    describe('when the project has fewer collaborators than allowed', function () {
      beforeEach(function (ctx) {
        ctx.current_number = 1
        ctx.user.features.collaborators = 2
        ctx.invite_count = 0
        ctx.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount = sinon
          .stub()
          .resolves(ctx.current_number)
        ctx.CollaboratorsInviteGetter.promises.getEditInviteCount = sinon
          .stub()
          .resolves(ctx.invite_count)
      })

      it('should return true', async function (ctx) {
        const result =
          await ctx.LimitationsManager.promises.canAddXEditCollaborators(
            ctx.projectId,
            1
          )
        expect(result).to.be.true
      })
    })

    describe('when the project has fewer collaborators and invites than allowed', function () {
      beforeEach(function (ctx) {
        ctx.current_number = 1
        ctx.user.features.collaborators = 4
        ctx.invite_count = 1
        ctx.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount = sinon
          .stub()
          .resolves(ctx.current_number)
        ctx.CollaboratorsInviteGetter.promises.getEditInviteCount = sinon
          .stub()
          .resolves(ctx.invite_count)
      })

      it('should return true', async function (ctx) {
        const result =
          await ctx.LimitationsManager.promises.canAddXEditCollaborators(
            ctx.projectId,
            1
          )
        expect(result).to.be.true
      })
    })

    describe('when the project has fewer collaborators than allowed but I want to add more than allowed', function () {
      beforeEach(function (ctx) {
        ctx.current_number = 1
        ctx.user.features.collaborators = 2
        ctx.invite_count = 0
        ctx.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount = sinon
          .stub()
          .resolves(ctx.current_number)
        ctx.CollaboratorsInviteGetter.promises.getEditInviteCount = sinon
          .stub()
          .resolves(ctx.invite_count)
      })

      it('should return false', async function (ctx) {
        const result =
          await ctx.LimitationsManager.promises.canAddXEditCollaborators(
            ctx.projectId,
            2
          )
        expect(result).to.be.false
      })
    })

    describe('when the project has more collaborators than allowed', function () {
      beforeEach(function (ctx) {
        ctx.current_number = 3
        ctx.user.features.collaborators = 2
        ctx.invite_count = 0
        ctx.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount = sinon
          .stub()
          .resolves(ctx.current_number)
        ctx.CollaboratorsInviteGetter.promises.getEditInviteCount = sinon
          .stub()
          .resolves(ctx.invite_count)
      })

      it('should return false', async function (ctx) {
        const result =
          await ctx.LimitationsManager.promises.canAddXEditCollaborators(
            ctx.projectId,
            1
          )
        expect(result).to.be.false
      })
    })

    describe('when the project has infinite collaborators', function () {
      beforeEach(function (ctx) {
        ctx.current_number = 100
        ctx.user.features.collaborators = -1
        ctx.invite_count = 0
        ctx.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount = sinon
          .stub()
          .resolves(ctx.current_number)
        ctx.CollaboratorsInviteGetter.promises.getEditInviteCount = sinon
          .stub()
          .resolves(ctx.invite_count)
      })

      it('should return true', async function (ctx) {
        const result =
          await ctx.LimitationsManager.promises.canAddXEditCollaborators(
            ctx.projectId,
            1
          )
        expect(result).to.be.true
      })
    })

    describe('when the project has more invites than allowed', function () {
      beforeEach(function (ctx) {
        ctx.current_number = 0
        ctx.user.features.collaborators = 2
        ctx.invite_count = 2
        ctx.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount = sinon
          .stub()
          .resolves(ctx.current_number)
        ctx.CollaboratorsInviteGetter.promises.getEditInviteCount = sinon
          .stub()
          .resolves(ctx.invite_count)
      })

      it('should return false', async function (ctx) {
        const result =
          await ctx.LimitationsManager.promises.canAddXEditCollaborators(
            ctx.projectId,
            1
          )
        expect(result).to.be.false
      })
    })

    describe('when the project has more invites and collaborators than allowed', function () {
      beforeEach(function (ctx) {
        ctx.current_number = 1
        ctx.user.features.collaborators = 2
        ctx.invite_count = 1
        ctx.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount = sinon
          .stub()
          .resolves(ctx.current_number)
        ctx.CollaboratorsInviteGetter.promises.getEditInviteCount = sinon
          .stub()
          .resolves(ctx.invite_count)
      })

      it('should return false', async function (ctx) {
        const result =
          await ctx.LimitationsManager.promises.canAddXEditCollaborators(
            ctx.projectId,
            1
          )
        expect(result).to.be.false
      })
    })
  })

  describe('canChangeCollaboratorPrivilegeLevel', function () {
    beforeEach(function (ctx) {
      ctx.collaboratorId = 'collaborator-id'
      ctx.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel.resolves(
        'readOnly'
      )
    })

    describe("when the limit hasn't been reached", function () {
      it('accepts changing a viewer to an editor', async function (ctx) {
        const result =
          await ctx.LimitationsManager.promises.canChangeCollaboratorPrivilegeLevel(
            ctx.projectId,
            ctx.collaboratorId,
            'readAndWrite'
          )
        expect(result).to.be.true
      })
    })

    describe('when the limit has been reached', function () {
      beforeEach(function (ctx) {
        ctx.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount.resolves(
          1
        )
      })

      it('accepts changing a reviewer to an editor', async function (ctx) {
        ctx.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel.resolves(
          'review'
        )
        const result =
          await ctx.LimitationsManager.promises.canChangeCollaboratorPrivilegeLevel(
            ctx.projectId,
            ctx.collaboratorId,
            'readAndWrite'
          )
        expect(result).to.be.true
      })

      it('rejects changing a viewer to a reviewer', async function (ctx) {
        const result =
          await ctx.LimitationsManager.promises.canChangeCollaboratorPrivilegeLevel(
            ctx.projectId,
            ctx.collaboratorId,
            'review'
          )
        expect(result).to.be.false
      })
    })
  })

  describe('userHasSubscription', function () {
    beforeEach(function (ctx) {
      ctx.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves()
    })

    it('should return true if the recurly token is set', async function (ctx) {
      ctx.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves({
          recurlySubscription_id: '1234',
        })
      const { hasSubscription } =
        await ctx.LimitationsManager.promises.userHasSubscription(ctx.user)
      expect(hasSubscription).to.be.true
    })

    it('should return true if the paymentProvider field is set', async function (ctx) {
      ctx.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves({
          paymentProvider: {
            subscriptionId: '1234',
          },
        })
      const { hasSubscription } =
        await ctx.LimitationsManager.promises.userHasSubscription(ctx.user)
      expect(hasSubscription).to.be.true
    })

    it('should return false if the recurly token is not set', async function (ctx) {
      ctx.SubscriptionLocator.promises.getUsersSubscription.resolves({})
      const { hasSubscription } =
        await ctx.LimitationsManager.promises.userHasSubscription(ctx.user)
      expect(hasSubscription).to.be.false
    })

    it('should return false if the subscription is undefined', async function (ctx) {
      ctx.SubscriptionLocator.promises.getUsersSubscription.resolves()
      const { hasSubscription } =
        await ctx.LimitationsManager.promises.userHasSubscription(ctx.user)
      expect(hasSubscription).to.be.false
    })

    it('should return the subscription', async function (ctx) {
      const stubbedSubscription = { freeTrial: {}, token: '' }
      ctx.SubscriptionLocator.promises.getUsersSubscription.resolves(
        stubbedSubscription
      )
      const { subscription } =
        await ctx.LimitationsManager.promises.userHasSubscription(ctx.user)
      expect(subscription).to.deep.equal(stubbedSubscription)
    })

    describe('when user has a custom account', function () {
      beforeEach(function (ctx) {
        ctx.fakeSubscription = { customAccount: true }
        ctx.SubscriptionLocator.promises.getUsersSubscription.resolves(
          ctx.fakeSubscription
        )
      })

      it('should return true', async function (ctx) {
        const { hasSubscription } =
          await ctx.LimitationsManager.promises.userHasSubscription(ctx.user)
        expect(hasSubscription).to.be.true
      })

      it('should return the subscription', async function (ctx) {
        const { subscription } =
          await ctx.LimitationsManager.promises.userHasSubscription(ctx.user)
        expect(subscription).to.deep.equal(ctx.fakeSubscription)
      })
    })
  })

  describe('userIsMemberOfGroupSubscription', function () {
    beforeEach(function (ctx) {
      ctx.SubscriptionLocator.promises.getMemberSubscriptions = sinon
        .stub()
        .resolves()
    })

    it('should return false if there are no groups subcriptions', async function (ctx) {
      ctx.SubscriptionLocator.promises.getMemberSubscriptions.resolves([])
      const { isMember } =
        await ctx.LimitationsManager.promises.userIsMemberOfGroupSubscription(
          ctx.user
        )
      expect(isMember).to.be.false
    })

    it('should return true if there are no groups subcriptions', async function (ctx) {
      const subscriptions = ['mock-subscription']
      ctx.SubscriptionLocator.promises.getMemberSubscriptions.resolves(
        subscriptions
      )
      const { isMember, subscriptions: retSubscriptions } =
        await ctx.LimitationsManager.promises.userIsMemberOfGroupSubscription(
          ctx.user
        )
      expect(isMember).to.be.true
      expect(retSubscriptions).to.deep.equal(subscriptions)
    })
  })

  describe('hasPaidSubscription', function () {
    beforeEach(function (ctx) {
      ctx.SubscriptionLocator.promises.getMemberSubscriptions = sinon
        .stub()
        .resolves([])
      ctx.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves(null)
    })

    it('should return true if userIsMemberOfGroupSubscription', async function (ctx) {
      ctx.SubscriptionLocator.promises.getMemberSubscriptions = sinon
        .stub()
        .resolves([{ _id: '123' }])
      const { hasPaidSubscription } =
        await ctx.LimitationsManager.promises.hasPaidSubscription(ctx.user)
      expect(hasPaidSubscription).to.be.true
    })

    it('should return true if userHasSubscription', async function (ctx) {
      ctx.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves({ recurlySubscription_id: '123' })
      const { hasPaidSubscription } =
        await ctx.LimitationsManager.promises.hasPaidSubscription(ctx.user)
      expect(hasPaidSubscription).to.be.true
    })

    it('should return false if none are true', async function (ctx) {
      const { hasPaidSubscription } =
        await ctx.LimitationsManager.promises.hasPaidSubscription(ctx.user)
      expect(hasPaidSubscription).to.be.false
    })

    it('should have userHasSubscriptionOrIsGroupMember alias', async function (ctx) {
      const { hasPaidSubscription } =
        await ctx.LimitationsManager.promises.userHasSubscriptionOrIsGroupMember(
          ctx.user
        )
      expect(hasPaidSubscription).to.be.false
    })
  })

  describe('hasGroupMembersLimitReached', function () {
    beforeEach(function (ctx) {
      ctx.subscriptionId = '12312'
      ctx.subscription = {
        membersLimit: 3,
        member_ids: ['', ''],
        teamInvites: [
          { email: 'bob@example.com', sentAt: new Date(), token: 'hey' },
        ],
      }
    })

    it('should return true if the limit is hit (including members and invites)', async function (ctx) {
      ctx.SubscriptionLocator.promises.getSubscription.resolves(
        ctx.subscription
      )
      const { limitReached } =
        await ctx.LimitationsManager.promises.hasGroupMembersLimitReached(
          ctx.subscriptionId
        )
      expect(limitReached).to.be.true
    })

    it('should return false if the limit is not hit (including members and invites)', async function (ctx) {
      ctx.subscription.membersLimit = 4
      ctx.SubscriptionLocator.promises.getSubscription.resolves(
        ctx.subscription
      )
      const { limitReached } =
        await ctx.LimitationsManager.promises.hasGroupMembersLimitReached(
          ctx.subscriptionId
        )
      expect(limitReached).to.be.false
    })

    it('should return true if the limit has been exceded (including members and invites)', async function (ctx) {
      ctx.subscription.membersLimit = 2
      ctx.SubscriptionLocator.promises.getSubscription.resolves(
        ctx.subscription
      )
      const { limitReached } =
        await ctx.LimitationsManager.promises.hasGroupMembersLimitReached(
          ctx.subscriptionId
        )
      expect(limitReached).to.be.true
    })
  })
})
