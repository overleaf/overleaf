const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath =
  '../../../../app/src/Features/Subscription/TeamInvitesHandler'

const { ObjectId } = require('mongodb-legacy')
const Errors = require('../../../../app/src/Features/Errors/Errors')

describe('TeamInvitesHandler', function () {
  beforeEach(function () {
    this.manager = {
      _id: '666666',
      first_name: 'Daenerys',
      last_name: 'Targaryen',
      email: 'daenerys@example.com',
      emails: [{ email: 'daenerys@example.com' }],
    }

    this.token = 'aaaaaaaaaaaaaaaaaaaaaa'

    this.teamInvite = {
      email: 'jorah@example.com',
      token: this.token,
    }
    // ensure teamInvite can be converted from Document to Object
    this.teamInvite.toObject = () => this.teamInvite

    this.subscription = {
      id: '55153a8014829a865bbf700d',
      _id: new ObjectId('55153a8014829a865bbf700d'),
      recurlySubscription_id: '1a2b3c4d5e6f7g',
      admin_id: this.manager._id,
      groupPlan: true,
      member_ids: [],
      teamInvites: [this.teamInvite],
      save: sinon.stub().resolves(),
    }

    this.SubscriptionLocator = {
      promises: {
        getUsersSubscription: sinon.stub(),
        getSubscription: sinon.stub().resolves(this.subscription),
      },
    }

    this.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(),
        getUserByAnyEmail: sinon.stub().resolves(),
        getUserByMainEmail: sinon.stub().resolves(),
      },
    }

    this.SubscriptionUpdater = {
      promises: {
        addUserToGroup: sinon.stub().resolves(),
        deleteSubscription: sinon.stub().resolves(),
      },
    }

    this.LimitationsManager = {
      teamHasReachedMemberLimit: sinon.stub().returns(false),
    }

    this.Subscription = {
      findOne: sinon.stub().resolves(),
      updateOne: sinon.stub().resolves(),
    }

    this.SSOConfig = {
      findById: sinon.stub().resolves(),
    }

    this.EmailHandler = {
      promises: {
        sendEmail: sinon.stub().resolves(null),
      },
    }

    this.newToken = 'bbbbbbbbb'

    this.crypto = {
      randomBytes: () => {
        return { toString: sinon.stub().returns(this.newToken) }
      },
    }

    this.UserGetter.promises.getUser
      .withArgs(this.manager._id)
      .resolves(this.manager)
    this.UserGetter.promises.getUserByAnyEmail
      .withArgs(this.manager.email)
      .resolves(this.manager)
    this.UserGetter.promises.getUserByMainEmail
      .withArgs(this.manager.email)
      .resolves(this.manager)

    this.SubscriptionLocator.promises.getUsersSubscription.resolves(
      this.subscription
    )

    this.NotificationsBuilder = {
      promises: {
        groupInvitation: sinon.stub().returns({
          create: sinon.stub().resolves(),
          read: sinon.stub().resolves(),
        }),
      },
    }

    this.Subscription.findOne.resolves(this.subscription)

    this.RecurlyClient = {
      promises: {
        terminateSubscriptionByUuid: sinon.stub().resolves(),
      },
    }

    this.TeamInvitesHandler = SandboxedModule.require(modulePath, {
      requires: {
        'mongodb-legacy': { ObjectId },
        crypto: this.crypto,
        '@overleaf/settings': { siteUrl: 'http://example.com' },
        '../../models/TeamInvite': { TeamInvite: (this.TeamInvite = {}) },
        '../../models/Subscription': { Subscription: this.Subscription },
        '../../models/SSOConfig': { SSOConfig: this.SSOConfig },
        '../User/UserGetter': this.UserGetter,
        './SubscriptionLocator': this.SubscriptionLocator,
        './SubscriptionUpdater': this.SubscriptionUpdater,
        './LimitationsManager': this.LimitationsManager,
        '../Email/EmailHandler': this.EmailHandler,
        '../Notifications/NotificationsBuilder': this.NotificationsBuilder,
        '../../infrastructure/Modules': (this.Modules = {
          promises: { hooks: { fire: sinon.stub().resolves() } },
        }),
        './RecurlyClient': this.RecurlyClient,
      },
    })
  })

  describe('getInvite', function () {
    it("returns the invite if there's one", async function () {
      const { invite, subscription } =
        await this.TeamInvitesHandler.promises.getInvite(this.token)

      expect(invite).to.deep.eq(this.teamInvite)
      expect(subscription).to.deep.eq(this.subscription)
    })

    it("returns teamNotFound if there's none", async function () {
      this.Subscription.findOne = sinon.stub().resolves(null)

      let error
      try {
        await this.TeamInvitesHandler.promises.getInvite(this.token)
      } catch (err) {
        error = err
      }

      expect(error).to.be.instanceOf(Errors.NotFoundError)
    })
  })

  describe('createInvite', function () {
    it('adds the team invite to the subscription', async function () {
      const invite = await this.TeamInvitesHandler.promises.createInvite(
        this.manager._id,
        this.subscription,
        'John.Snow@example.com'
      )
      expect(invite.token).to.eq(this.newToken)
      expect(invite.email).to.eq('john.snow@example.com')
      expect(invite.inviterName).to.eq(
        'Daenerys Targaryen (daenerys@example.com)'
      )
      expect(invite.invite).to.be.true
      expect(this.subscription.teamInvites).to.deep.include(invite)
    })

    it('sends an email', async function () {
      await this.TeamInvitesHandler.promises.createInvite(
        this.manager._id,
        this.subscription,
        'John.Snow@example.com'
      )

      this.EmailHandler.promises.sendEmail
        .calledWith(
          'verifyEmailToJoinTeam',
          sinon.match({
            to: 'john.snow@example.com',
            inviter: this.manager,
            acceptInviteUrl: `http://example.com/subscription/invites/${this.newToken}/`,
          })
        )
        .should.equal(true)
    })

    it('refreshes the existing invite if the email has already been invited', async function () {
      const originalInvite = Object.assign({}, this.teamInvite)

      const invite = await this.TeamInvitesHandler.promises.createInvite(
        this.manager._id,
        this.subscription,
        originalInvite.email
      )
      expect(invite).to.exist

      expect(this.subscription.teamInvites.length).to.eq(1)
      expect(this.subscription.teamInvites).to.deep.include(invite)

      expect(invite.email).to.eq(originalInvite.email)

      this.subscription.save.calledOnce.should.eq(true)
    })

    it('removes any legacy invite from the subscription', async function () {
      await this.TeamInvitesHandler.promises.createInvite(
        this.manager._id,
        this.subscription,
        'John.Snow@example.com'
      )

      this.Subscription.updateOne
        .calledWith(
          { _id: new ObjectId('55153a8014829a865bbf700d') },
          { $pull: { invited_emails: 'john.snow@example.com' } }
        )
        .should.eq(true)
    })

    it('add user to subscription if inviting self', async function () {
      const invite = await this.TeamInvitesHandler.promises.createInvite(
        this.manager._id,
        this.subscription,
        this.manager.email
      )
      sinon.assert.calledWith(
        this.SubscriptionUpdater.promises.addUserToGroup,
        this.subscription._id,
        this.manager._id
      )
      sinon.assert.notCalled(this.subscription.save)
      expect(invite.token).to.not.exist
      expect(invite.email).to.eq(this.manager.email)
      expect(invite.first_name).to.eq(this.manager.first_name)
      expect(invite.last_name).to.eq(this.manager.last_name)
      expect(invite.invite).to.be.false
    })

    it('sends an SSO invite if SSO is enabled and inviting self', async function () {
      this.subscription.ssoConfig = new ObjectId('abc123abc123abc123abc123')
      this.SSOConfig.findById
        .withArgs(this.subscription.ssoConfig)
        .resolves({ enabled: true })

      await this.TeamInvitesHandler.promises.createInvite(
        this.manager._id,
        this.subscription,
        this.manager.email
      )
      sinon.assert.calledWith(
        this.Modules.promises.hooks.fire,
        'sendGroupSSOReminder',
        this.manager._id,
        this.subscription._id
      )
    })

    it('does not send an SSO invite if SSO is disabled and inviting self', async function () {
      this.subscription.ssoConfig = new ObjectId('abc123abc123abc123abc123')
      this.SSOConfig.findById
        .withArgs(this.subscription.ssoConfig)
        .resolves({ enabled: false })

      await this.TeamInvitesHandler.promises.createInvite(
        this.manager._id,
        this.subscription,
        this.manager.email
      )
      sinon.assert.notCalled(this.Modules.promises.hooks.fire)
    })

    it('sends a notification if inviting registered user', async function () {
      const id = new ObjectId('6a6b3a8014829a865bbf700d')
      const managedUsersEnabled = false

      this.UserGetter.promises.getUserByMainEmail
        .withArgs('john.snow@example.com')
        .resolves({
          _id: id,
        })

      const invite = await this.TeamInvitesHandler.promises.createInvite(
        this.manager._id,
        this.subscription,
        'John.Snow@example.com'
      )
      this.NotificationsBuilder.promises
        .groupInvitation(
          id.toString(),
          this.subscription._id,
          managedUsersEnabled
        )
        .create.calledWith(invite)
        .should.eq(true)
    })
  })

  describe('importInvite', function () {
    beforeEach(function () {
      this.sentAt = new Date()
    })

    it('can imports an invite from v1', function () {
      this.TeamInvitesHandler.importInvite(
        this.subscription,
        'A-Team',
        'hannibal@a-team.org',
        'secret',
        this.sentAt,
        error => {
          expect(error).not.to.exist

          this.subscription.save.calledOnce.should.eq(true)

          const invite = this.subscription.teamInvites.find(
            i => i.email === 'hannibal@a-team.org'
          )
          expect(invite.token).to.eq('secret')
          expect(invite.sentAt).to.eq(this.sentAt)
        }
      )
    })
  })

  describe('acceptInvite', function () {
    beforeEach(function () {
      this.user = {
        id: '123456789',
        first_name: 'Tyrion',
        last_name: 'Lannister',
        email: 'tyrion@example.com',
      }

      this.ipAddress = '127.0.0.1'

      this.UserGetter.promises.getUserByAnyEmail
        .withArgs(this.user.email)
        .resolves(this.user)

      this.subscription.teamInvites.push({
        email: 'john.snow@example.com',
        token: 'dddddddd',
        inviterName: 'Daenerys Targaryen (daenerys@example.com)',
      })
    })

    describe('with standard group', function () {
      it('adds the user to the team', async function () {
        await this.TeamInvitesHandler.promises.acceptInvite(
          'dddddddd',
          this.user.id,
          this.ipAddress
        )
        this.SubscriptionUpdater.promises.addUserToGroup
          .calledWith(this.subscription._id, this.user.id)
          .should.eq(true)
      })

      it('removes the invite from the subscription', async function () {
        await this.TeamInvitesHandler.promises.acceptInvite(
          'dddddddd',
          this.user.id,
          this.ipAddress
        )
        this.Subscription.updateOne
          .calledWith(
            { _id: new ObjectId('55153a8014829a865bbf700d') },
            { $pull: { teamInvites: { email: 'john.snow@example.com' } } }
          )
          .should.eq(true)
      })

      it('removes dashboard notification after they accepted group invitation', async function () {
        const managedUsersEnabled = false

        await this.TeamInvitesHandler.promises.acceptInvite(
          'dddddddd',
          this.user.id,
          this.ipAddress
        )
        sinon.assert.called(
          this.NotificationsBuilder.promises.groupInvitation(
            this.user.id,
            this.subscription._id,
            managedUsersEnabled
          ).read
        )
      })

      it('should not schedule an SSO invite reminder', async function () {
        await this.TeamInvitesHandler.promises.acceptInvite(
          'dddddddd',
          this.user.id,
          this.ipAddress
        )
        sinon.assert.notCalled(this.Modules.promises.hooks.fire)
      })
    })

    describe('with managed group', function () {
      it('should enroll the group member', async function () {
        this.subscription.managedUsersEnabled = true

        await this.TeamInvitesHandler.promises.acceptInvite(
          'dddddddd',
          this.user.id,
          this.ipAddress
        )
        sinon.assert.calledWith(
          this.SubscriptionUpdater.promises.deleteSubscription,
          this.subscription,
          { id: this.user.id, ip: this.ipAddress }
        )
        sinon.assert.calledWith(
          this.RecurlyClient.promises.terminateSubscriptionByUuid,
          this.subscription.recurlySubscription_id
        )
        sinon.assert.calledWith(
          this.Modules.promises.hooks.fire,
          'enrollInManagedSubscription',
          this.user.id,
          this.subscription
        )
      })
    })

    describe('with group SSO enabled', function () {
      it('should schedule an SSO invite reminder', async function () {
        this.subscription.ssoConfig = 'ssoconfig1'
        this.SSOConfig.findById
          .withArgs('ssoconfig1')
          .resolves({ enabled: true })

        await this.TeamInvitesHandler.promises.acceptInvite(
          'dddddddd',
          this.user.id,
          this.ipAddress
        )
        sinon.assert.calledWith(
          this.Modules.promises.hooks.fire,
          'scheduleGroupSSOReminder',
          this.user.id,
          this.subscription._id
        )
      })
    })
  })

  describe('revokeInvite', function () {
    it('removes the team invite from the subscription', async function () {
      await this.TeamInvitesHandler.promises.revokeInvite(
        this.manager._id,
        this.subscription,
        'jorah@example.com'
      )
      this.Subscription.updateOne
        .calledWith(
          { _id: new ObjectId('55153a8014829a865bbf700d') },
          { $pull: { teamInvites: { email: 'jorah@example.com' } } }
        )
        .should.eq(true)

      this.Subscription.updateOne
        .calledWith(
          { _id: new ObjectId('55153a8014829a865bbf700d') },
          { $pull: { invited_emails: 'jorah@example.com' } }
        )
        .should.eq(true)
    })

    it('removes dashboard notification for pending group invitation', async function () {
      const managedUsersEnabled = false

      const pendingUser = {
        id: '1a2b',
        email: 'tyrion@example.com',
      }

      this.UserGetter.promises.getUserByAnyEmail
        .withArgs(pendingUser.email)
        .resolves(pendingUser)

      await this.TeamInvitesHandler.promises.revokeInvite(
        this.manager._id,
        this.subscription,
        pendingUser.email
      )

      sinon.assert.called(
        this.NotificationsBuilder.promises.groupInvitation(
          pendingUser.id,
          this.subscription._id,
          managedUsersEnabled
        ).read
      )
    })
  })

  describe('createTeamInvitesForLegacyInvitedEmail', function () {
    beforeEach(function () {
      this.subscription.invited_emails = [
        'eddard@example.com',
        'robert@example.com',
      ]
      this.TeamInvitesHandler.createInvite = sinon.stub().resolves(null)
      this.SubscriptionLocator.promises.getGroupsWithEmailInvite = sinon
        .stub()
        .resolves([this.subscription])
    })

    it('sends an invitation email to addresses in the legacy invited_emails field', async function () {
      const invites =
        await this.TeamInvitesHandler.promises.createTeamInvitesForLegacyInvitedEmail(
          'eddard@example.com'
        )

      expect(invites.length).to.eq(1)

      const [invite] = invites
      expect(invite.token).to.eq(this.newToken)
      expect(invite.email).to.eq('eddard@example.com')
      expect(invite.inviterName).to.eq(
        'Daenerys Targaryen (daenerys@example.com)'
      )
      expect(invite.invite).to.be.true
      expect(this.subscription.teamInvites).to.deep.include(invite)
    })
  })

  describe('validation', function () {
    it("doesn't create an invite if the team limit has been reached", async function () {
      this.LimitationsManager.teamHasReachedMemberLimit = sinon
        .stub()
        .returns(true)
      let error

      try {
        await this.TeamInvitesHandler.promises.createInvite(
          this.manager._id,
          this.subscription,
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

    it("doesn't create an invite if the subscription is not in a group plan", async function () {
      this.subscription.groupPlan = false
      let error

      try {
        await this.TeamInvitesHandler.promises.createInvite(
          this.manager._id,
          this.subscription,
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

    it("doesn't create an invite if the user is already part of the team", async function () {
      const member = {
        id: '1a2b',
        _id: '1a2b',
        email: 'tyrion@example.com',
      }

      this.subscription.member_ids = [member.id]
      this.UserGetter.promises.getUserByAnyEmail
        .withArgs(member.email)
        .resolves(member)

      let error

      try {
        await this.TeamInvitesHandler.promises.createInvite(
          this.manager._id,
          this.subscription,
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
