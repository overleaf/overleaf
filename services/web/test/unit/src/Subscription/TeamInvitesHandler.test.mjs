import { vi, expect } from 'vitest'
import sinon from 'sinon'

import mongodb from 'mongodb-legacy'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
const modulePath =
  '../../../../app/src/Features/Subscription/TeamInvitesHandler'

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

const { ObjectId } = mongodb

describe('TeamInvitesHandler', function () {
  beforeEach(async function (ctx) {
    ctx.manager = {
      _id: '666666',
      first_name: 'Daenerys',
      last_name: 'Targaryen',
      email: 'daenerys@example.com',
      emails: [{ email: 'daenerys@example.com' }],
    }

    ctx.token = 'aaaaaaaaaaaaaaaaaaaaaa'

    ctx.teamInvite = {
      email: 'jorah@example.com',
      token: ctx.token,
    }
    // ensure teamInvite can be converted from Document to Object
    ctx.teamInvite.toObject = () => ctx.teamInvite

    ctx.subscription = {
      id: '55153a8014829a865bbf700d',
      _id: new ObjectId('55153a8014829a865bbf700d'),
      recurlySubscription_id: '1a2b3c4d5e6f7g',
      admin_id: ctx.manager._id,
      groupPlan: true,
      member_ids: [],
      teamInvites: [ctx.teamInvite],
      save: sinon.stub().resolves(),
    }

    ctx.SubscriptionLocator = {
      promises: {
        getUsersSubscription: sinon.stub(),
        getSubscription: sinon.stub().resolves(ctx.subscription),
      },
    }

    ctx.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(),
        getUserByAnyEmail: sinon.stub().resolves(),
        getUserByMainEmail: sinon.stub().resolves(),
      },
    }

    ctx.SubscriptionUpdater = {
      promises: {
        addUserToGroup: sinon.stub().resolves(),
        deleteSubscription: sinon.stub().resolves(),
      },
    }

    ctx.LimitationsManager = {
      teamHasReachedMemberLimit: sinon.stub().returns(false),
    }

    ctx.Subscription = {
      findOne: sinon.stub().resolves(),
      updateOne: sinon.stub().resolves(),
    }

    ctx.SSOConfig = {
      findById: sinon.stub().resolves(),
    }

    ctx.EmailHandler = {
      promises: {
        sendEmail: sinon.stub().resolves(null),
      },
    }

    ctx.newToken = 'bbbbbbbbb'

    ctx.crypto = {
      randomBytes: () => {
        return { toString: sinon.stub().returns(ctx.newToken) }
      },
    }

    ctx.UserGetter.promises.getUser
      .withArgs(ctx.manager._id)
      .resolves(ctx.manager)
    ctx.UserGetter.promises.getUserByAnyEmail
      .withArgs(ctx.manager.email)
      .resolves(ctx.manager)
    ctx.UserGetter.promises.getUserByMainEmail
      .withArgs(ctx.manager.email)
      .resolves(ctx.manager)

    ctx.SubscriptionLocator.promises.getUsersSubscription.resolves(
      ctx.subscription
    )

    ctx.NotificationsBuilder = {
      promises: {
        groupInvitation: sinon.stub().returns({
          create: sinon.stub().resolves(),
          read: sinon.stub().resolves(),
        }),
      },
    }

    ctx.Subscription.findOne.resolves(ctx.subscription)

    ctx.RecurlyClient = {
      promises: {
        terminateSubscriptionByUuid: sinon.stub().resolves(),
      },
    }

    vi.doMock('mongodb-legacy', () => ({
      default: { ObjectId },
    }))

    vi.doMock('crypto', () => ({
      default: ctx.crypto,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: { siteUrl: 'http://example.com', appName: 'Overleaf' },
    }))

    vi.doMock('../../../../app/src/models/TeamInvite', () => ({
      TeamInvite: (ctx.TeamInvite = {}),
    }))

    vi.doMock('../../../../app/src/models/Subscription', () => ({
      Subscription: ctx.Subscription,
    }))

    vi.doMock('../../../../app/src/models/SSOConfig', () => ({
      SSOConfig: ctx.SSOConfig,
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

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionUpdater',
      () => ({
        default: ctx.SubscriptionUpdater,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/LimitationsManager',
      () => ({
        default: ctx.LimitationsManager,
      })
    )

    vi.doMock('../../../../app/src/Features/Email/EmailHandler', () => ({
      default: ctx.EmailHandler,
    }))

    vi.doMock(
      '../../../../app/src/Features/Notifications/NotificationsBuilder',
      () => ({
        default: ctx.NotificationsBuilder,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: (ctx.Modules = {
        promises: { hooks: { fire: sinon.stub().resolves() } },
      }),
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/RecurlyClient',
      () => ({
        default: ctx.RecurlyClient,
      })
    )

    ctx.TeamInvitesHandler = (await import(modulePath)).default
  })

  describe('getInvite', function () {
    it("returns the invite if there's one", async function (ctx) {
      const { invite, subscription } =
        await ctx.TeamInvitesHandler.promises.getInvite(ctx.token)

      expect(invite).to.deep.eq(ctx.teamInvite)
      expect(subscription).to.deep.eq(ctx.subscription)
    })

    it("returns teamNotFound if there's none", async function (ctx) {
      ctx.Subscription.findOne = sinon.stub().resolves(null)

      let error
      try {
        await ctx.TeamInvitesHandler.promises.getInvite(ctx.token)
      } catch (err) {
        error = err
      }

      expect(error).to.be.instanceOf(Errors.NotFoundError)
    })
  })

  describe('createInvite', function () {
    it('adds the team invite to the subscription', async function (ctx) {
      const invite = await ctx.TeamInvitesHandler.promises.createInvite(
        ctx.manager._id,
        ctx.subscription,
        'John.Snow@example.com'
      )
      expect(invite.token).to.eq(ctx.newToken)
      expect(invite.email).to.eq('john.snow@example.com')
      expect(invite.inviterName).to.eq(
        'Daenerys Targaryen (daenerys@example.com)'
      )
      expect(invite.invite).to.be.true
      expect(ctx.subscription.teamInvites).to.deep.include(invite)
    })

    it('sends an email', async function (ctx) {
      await ctx.TeamInvitesHandler.promises.createInvite(
        ctx.manager._id,
        ctx.subscription,
        'John.Snow@example.com'
      )

      ctx.EmailHandler.promises.sendEmail
        .calledWith(
          'verifyEmailToJoinTeam',
          sinon.match({
            to: 'john.snow@example.com',
            inviter: ctx.manager,
            acceptInviteUrl: `http://example.com/subscription/invites/${ctx.newToken}/`,
          })
        )
        .should.equal(true)
    })

    it('refreshes the existing invite if the email has already been invited', async function (ctx) {
      const originalInvite = Object.assign({}, ctx.teamInvite)

      const invite = await ctx.TeamInvitesHandler.promises.createInvite(
        ctx.manager._id,
        ctx.subscription,
        originalInvite.email
      )
      expect(invite).to.exist

      expect(ctx.subscription.teamInvites.length).to.eq(1)
      expect(ctx.subscription.teamInvites).to.deep.include(invite)

      expect(invite.email).to.eq(originalInvite.email)

      ctx.subscription.save.calledOnce.should.eq(true)
    })

    it('removes any legacy invite from the subscription', async function (ctx) {
      await ctx.TeamInvitesHandler.promises.createInvite(
        ctx.manager._id,
        ctx.subscription,
        'John.Snow@example.com'
      )

      ctx.Subscription.updateOne
        .calledWith(
          { _id: new ObjectId('55153a8014829a865bbf700d') },
          { $pull: { invited_emails: 'john.snow@example.com' } }
        )
        .should.eq(true)
    })

    it('add user to subscription if inviting self', async function (ctx) {
      const invite = await ctx.TeamInvitesHandler.promises.createInvite(
        ctx.manager._id,
        ctx.subscription,
        ctx.manager.email
      )
      sinon.assert.calledWith(
        ctx.SubscriptionUpdater.promises.addUserToGroup,
        ctx.subscription._id,
        ctx.manager._id
      )
      sinon.assert.notCalled(ctx.subscription.save)
      expect(invite.token).to.not.exist
      expect(invite.email).to.eq(ctx.manager.email)
      expect(invite.first_name).to.eq(ctx.manager.first_name)
      expect(invite.last_name).to.eq(ctx.manager.last_name)
      expect(invite.invite).to.be.false
    })

    it('sends an SSO invite if SSO is enabled and inviting self', async function (ctx) {
      ctx.subscription.ssoConfig = new ObjectId('abc123abc123abc123abc123')
      ctx.SSOConfig.findById
        .withArgs(ctx.subscription.ssoConfig)
        .resolves({ enabled: true })

      await ctx.TeamInvitesHandler.promises.createInvite(
        ctx.manager._id,
        ctx.subscription,
        ctx.manager.email
      )
      sinon.assert.calledWith(
        ctx.Modules.promises.hooks.fire,
        'sendGroupSSOReminder',
        ctx.manager._id,
        ctx.subscription._id
      )
    })

    it('does not send an SSO invite if SSO is disabled and inviting self', async function (ctx) {
      ctx.subscription.ssoConfig = new ObjectId('abc123abc123abc123abc123')
      ctx.SSOConfig.findById
        .withArgs(ctx.subscription.ssoConfig)
        .resolves({ enabled: false })

      await ctx.TeamInvitesHandler.promises.createInvite(
        ctx.manager._id,
        ctx.subscription,
        ctx.manager.email
      )
      sinon.assert.notCalled(ctx.Modules.promises.hooks.fire)
    })

    it('sends a notification if inviting registered user', async function (ctx) {
      const id = new ObjectId('6a6b3a8014829a865bbf700d')
      const managedUsersEnabled = false

      ctx.UserGetter.promises.getUserByMainEmail
        .withArgs('john.snow@example.com')
        .resolves({
          _id: id,
        })

      const invite = await ctx.TeamInvitesHandler.promises.createInvite(
        ctx.manager._id,
        ctx.subscription,
        'John.Snow@example.com'
      )
      ctx.NotificationsBuilder.promises
        .groupInvitation(
          id.toString(),
          ctx.subscription._id,
          managedUsersEnabled
        )
        .create.calledWith(invite)
        .should.eq(true)
    })

    it('creates an audit log entry for group-invite-sent for managed subscription', async function (ctx) {
      ctx.subscription.managedUsersEnabled = true

      const auditLog = {
        initiatorId: ctx.manager._id,
        ipAddress: '192.0.2.1',
      }

      await ctx.TeamInvitesHandler.promises.createInvite(
        ctx.manager._id,
        ctx.subscription,
        'John.Snow@example.com',
        auditLog
      )

      sinon.assert.calledWith(
        ctx.Modules.promises.hooks.fire,
        'addGroupAuditLogEntry',
        sinon.match({
          initiatorId: auditLog.initiatorId,
          ipAddress: auditLog.ipAddress,
          groupId: ctx.subscription._id,
          operation: 'group-invite-sent',
          info: { invitedEmail: 'john.snow@example.com' },
        })
      )
    })

    it('does not create an audit log entry for non-managed subscription', async function (ctx) {
      ctx.subscription.managedUsersEnabled = false

      const auditLog = {
        initiatorId: ctx.manager._id,
        ipAddress: '192.0.2.1',
      }

      await ctx.TeamInvitesHandler.promises.createInvite(
        ctx.manager._id,
        ctx.subscription,
        'John.Snow@example.com',
        auditLog
      )

      sinon.assert.neverCalledWith(
        ctx.Modules.promises.hooks.fire,
        'addGroupAuditLogEntry'
      )
    })

    describe('when domain capture is enabled', function () {
      it('creates a domain capture invite', async function (ctx) {
        const initPath = '/saml/ukamf/init?group_id=12345'
        ctx.Modules.promises.hooks.fire.resolves([initPath])
        ctx.UserGetter.promises.getUser.resolves(ctx.manager)

        ctx.subscription.domainCaptureEnabled = true
        const invite = await ctx.TeamInvitesHandler.promises.createInvite(
          ctx.manager._id,
          ctx.subscription,
          'user@example.com',
          { domainCapture: true }
        )
        expect(invite.token).to.be.undefined
        expect(invite.domainCapture).to.be.true
        expect(invite.email).to.eq('user@example.com')

        sinon.assert.calledWith(
          ctx.Modules.promises.hooks.fire,
          'getGroupSSOInitPath',
          ctx.subscription,
          invite.email
        )

        ctx.EmailHandler.promises.sendEmail
          .calledWith(
            'verifyEmailToJoinTeam',
            sinon.match({
              to: 'user@example.com',
              inviter: ctx.manager,
              acceptInviteUrl: `http://example.com${initPath}`,
              appName: 'Overleaf',
            })
          )
          .should.equal(true)
      })

      describe('when managed users is also enabled', function () {
        it('creates a domain capture invite', async function (ctx) {
          ctx.SubscriptionLocator.promises.getAdminEmailAndName = sinon
            .stub()
            .resolves(ctx.manager)

          ctx.UserGetter.promises.getUserByAnyEmail
            .withArgs('user@example.com')
            .resolves(ctx.user)
          const initPath = '/saml/ukamf/init?group_id=12345'
          ctx.Modules.promises.hooks.fire.resolves([initPath])
          ctx.UserGetter.promises.getUser.resolves(ctx.manager)
          ctx.subscription.managedUsersEnabled = true
          ctx.subscription.domainCaptureEnabled = true
          const invite = await ctx.TeamInvitesHandler.promises.createInvite(
            ctx.manager._id,
            ctx.subscription,
            'user@example.com',
            { domainCapture: true }
          )
          expect(invite.token).to.be.undefined
          expect(invite.domainCapture).to.be.true
          expect(invite.email).to.eq('user@example.com')

          sinon.assert.calledWith(
            ctx.Modules.promises.hooks.fire,
            'getGroupSSOInitPath',
            ctx.subscription,
            invite.email
          )

          ctx.EmailHandler.promises.sendEmail
            .calledWith(
              'inviteNewUserToJoinManagedUsers',
              sinon.match({
                to: 'user@example.com',
                inviter: ctx.manager,
                acceptInviteUrl: `http://example.com${initPath}`,
                appName: 'Overleaf',
                admin: ctx.manager,
              })
            )
            .should.equal(true)
        })
      })
    })
  })

  describe('importInvite', function () {
    beforeEach(function (ctx) {
      ctx.sentAt = new Date()
    })

    it('can imports an invite from v1', function (ctx) {
      ctx.TeamInvitesHandler.importInvite(
        ctx.subscription,
        'A-Team',
        'hannibal@a-team.org',
        'secret',
        ctx.sentAt,
        error => {
          expect(error).not.to.exist

          ctx.subscription.save.calledOnce.should.eq(true)

          const invite = ctx.subscription.teamInvites.find(
            i => i.email === 'hannibal@a-team.org'
          )
          expect(invite.token).to.eq('secret')
          expect(invite.sentAt).to.eq(ctx.sentAt)
        }
      )
    })
  })

  describe('acceptInvite', function () {
    beforeEach(function (ctx) {
      ctx.user = {
        id: '123456789',
        first_name: 'Tyrion',
        last_name: 'Lannister',
        email: 'tyrion@example.com',
      }

      ctx.user_subscription = {
        id: '66264b9125930b976cc0811e',
        _id: new ObjectId('66264b9125930b976cc0811e'),
        groupPlan: false,
        recurlySubscription_id: 'fa1b2cfa156gh',
        admin_id: '123456789',
        member_ids: [],
        teamInvites: [],
        save: sinon.stub().resolves(),
      }

      ctx.ipAddress = '127.0.0.1'

      ctx.UserGetter.promises.getUserByAnyEmail
        .withArgs(ctx.user.email)
        .resolves(ctx.user)

      ctx.SubscriptionLocator.promises.getUsersSubscription
        .withArgs(ctx.user.id)
        .resolves(ctx.user_subscription)

      ctx.subscription.teamInvites.push({
        email: 'john.snow@example.com',
        token: 'dddddddd',
        inviterName: 'Daenerys Targaryen (daenerys@example.com)',
      })
    })

    describe('with standard group', function () {
      it('adds the user to the team', async function (ctx) {
        await ctx.TeamInvitesHandler.promises.acceptInvite(
          'dddddddd',
          ctx.user.id,
          ctx.ipAddress
        )
        ctx.SubscriptionUpdater.promises.addUserToGroup
          .calledWith(ctx.subscription._id, ctx.user.id)
          .should.eq(true)
      })

      it('removes the invite from the subscription', async function (ctx) {
        await ctx.TeamInvitesHandler.promises.acceptInvite(
          'dddddddd',
          ctx.user.id,
          ctx.ipAddress
        )
        ctx.Subscription.updateOne
          .calledWith(
            { _id: new ObjectId('55153a8014829a865bbf700d') },
            { $pull: { teamInvites: { email: 'john.snow@example.com' } } }
          )
          .should.eq(true)
      })

      it('removes dashboard notification after they accepted group invitation', async function (ctx) {
        const managedUsersEnabled = false

        await ctx.TeamInvitesHandler.promises.acceptInvite(
          'dddddddd',
          ctx.user.id,
          ctx.ipAddress
        )
        sinon.assert.called(
          ctx.NotificationsBuilder.promises.groupInvitation(
            ctx.user.id,
            ctx.subscription._id,
            managedUsersEnabled
          ).read
        )
      })

      it('should not schedule an SSO invite reminder', async function (ctx) {
        await ctx.TeamInvitesHandler.promises.acceptInvite(
          'dddddddd',
          ctx.user.id,
          ctx.ipAddress
        )
        sinon.assert.notCalled(ctx.Modules.promises.hooks.fire)
      })
    })

    describe('with managed group', function () {
      it('should enroll the group member', async function (ctx) {
        ctx.subscription.managedUsersEnabled = true

        await ctx.TeamInvitesHandler.promises.acceptInvite(
          'dddddddd',
          ctx.user.id,
          ctx.ipAddress
        )
        sinon.assert.calledWith(
          ctx.SubscriptionUpdater.promises.deleteSubscription,
          ctx.user_subscription,
          { id: ctx.user.id, ip: ctx.ipAddress }
        )
        sinon.assert.calledWith(
          ctx.Modules.promises.hooks.fire,
          'terminateSubscription',
          ctx.user_subscription
        )
        sinon.assert.calledWith(
          ctx.Modules.promises.hooks.fire,
          'enrollInManagedSubscription',
          ctx.user.id,
          ctx.subscription
        )
      })

      it('should not delete the users subscription if that subscription is also the join target', async function (ctx) {
        ctx.subscription.managedUsersEnabled = true
        ctx.SubscriptionLocator.promises.getUsersSubscription
          .withArgs(ctx.user.id)
          .resolves(ctx.subscription)

        await ctx.TeamInvitesHandler.promises.acceptInvite(
          'dddddddd',
          ctx.user.id,
          ctx.ipAddress
        )

        sinon.assert.notCalled(
          ctx.SubscriptionUpdater.promises.deleteSubscription
        )
      })
    })

    describe('with group SSO enabled', function () {
      it('should schedule an SSO invite reminder', async function (ctx) {
        ctx.subscription.ssoConfig = 'ssoconfig1'
        ctx.SSOConfig.findById
          .withArgs('ssoconfig1')
          .resolves({ enabled: true })

        await ctx.TeamInvitesHandler.promises.acceptInvite(
          'dddddddd',
          ctx.user.id,
          ctx.ipAddress
        )
        sinon.assert.calledWith(
          ctx.Modules.promises.hooks.fire,
          'scheduleGroupSSOReminder',
          ctx.user.id,
          ctx.subscription._id
        )
      })
    })
  })

  describe('revokeInvite', function () {
    it('removes the team invite from the subscription', async function (ctx) {
      await ctx.TeamInvitesHandler.promises.revokeInvite(
        ctx.manager._id,
        ctx.subscription,
        'jorah@example.com'
      )
      ctx.Subscription.updateOne
        .calledWith(
          { _id: new ObjectId('55153a8014829a865bbf700d') },
          { $pull: { teamInvites: { email: 'jorah@example.com' } } }
        )
        .should.eq(true)

      ctx.Subscription.updateOne
        .calledWith(
          { _id: new ObjectId('55153a8014829a865bbf700d') },
          { $pull: { invited_emails: 'jorah@example.com' } }
        )
        .should.eq(true)
    })

    it('removes dashboard notification for pending group invitation', async function (ctx) {
      const managedUsersEnabled = false

      const pendingUser = {
        id: '1a2b',
        email: 'tyrion@example.com',
      }

      ctx.UserGetter.promises.getUserByAnyEmail
        .withArgs(pendingUser.email)
        .resolves(pendingUser)

      await ctx.TeamInvitesHandler.promises.revokeInvite(
        ctx.manager._id,
        ctx.subscription,
        pendingUser.email
      )

      sinon.assert.called(
        ctx.NotificationsBuilder.promises.groupInvitation(
          pendingUser.id,
          ctx.subscription._id,
          managedUsersEnabled
        ).read
      )
    })
  })

  describe('createTeamInvitesForLegacyInvitedEmail', function () {
    beforeEach(function (ctx) {
      ctx.subscription.invited_emails = [
        'eddard@example.com',
        'robert@example.com',
      ]
      ctx.TeamInvitesHandler.createInvite = sinon.stub().resolves(null)
      ctx.SubscriptionLocator.promises.getGroupsWithEmailInvite = sinon
        .stub()
        .resolves([ctx.subscription])
    })

    it('sends an invitation email to addresses in the legacy invited_emails field', async function (ctx) {
      const invites =
        await ctx.TeamInvitesHandler.promises.createTeamInvitesForLegacyInvitedEmail(
          'eddard@example.com'
        )

      expect(invites.length).to.eq(1)

      const [invite] = invites
      expect(invite.token).to.eq(ctx.newToken)
      expect(invite.email).to.eq('eddard@example.com')
      expect(invite.inviterName).to.eq(
        'Daenerys Targaryen (daenerys@example.com)'
      )
      expect(invite.invite).to.be.true
      expect(ctx.subscription.teamInvites).to.deep.include(invite)
    })
  })

  describe('validation', function () {
    it("doesn't create an invite if the team limit has been reached", async function (ctx) {
      ctx.LimitationsManager.teamHasReachedMemberLimit = sinon
        .stub()
        .returns(true)
      let error

      try {
        await ctx.TeamInvitesHandler.promises.createInvite(
          ctx.manager._id,
          ctx.subscription,
          'John.Snow@example.com'
        )
      } catch (err) {
        error = err
      }

      expect(error).to.exist

      expect(error).to.deep.equal({
        limitReached: true,
      })
    })

    it("doesn't create an invite if the subscription is not in a group plan", async function (ctx) {
      ctx.subscription.groupPlan = false
      let error

      try {
        await ctx.TeamInvitesHandler.promises.createInvite(
          ctx.manager._id,
          ctx.subscription,
          'John.Snow@example.com'
        )
      } catch (err) {
        error = err
      }

      expect(error).to.exist

      expect(error).to.deep.equal({
        wrongPlan: true,
      })
    })

    it("doesn't create an invite if the user is already part of the team", async function (ctx) {
      const member = {
        id: '1a2b',
        _id: '1a2b',
        email: 'tyrion@example.com',
      }

      ctx.subscription.member_ids = [member.id]
      ctx.UserGetter.promises.getUserByAnyEmail
        .withArgs(member.email)
        .resolves(member)

      let error

      try {
        await ctx.TeamInvitesHandler.promises.createInvite(
          ctx.manager._id,
          ctx.subscription,
          'tyrion@example.com'
        )
      } catch (err) {
        error = err
      }

      expect(error).to.exist

      expect(error).to.eql({
        alreadyInTeam: true,
      })
    })
  })
})
