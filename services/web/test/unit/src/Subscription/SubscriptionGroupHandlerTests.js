const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionGroupHandler'

describe('SubscriptionGroupHandler', function () {
  beforeEach(function () {
    this.adminUser_id = '12321'
    this.newEmail = 'bob@smith.com'
    this.user_id = '3121321'
    this.email = 'jim@example.com'
    this.user = { _id: this.user_id, email: this.newEmail }
    this.subscription_id = '31DSd1123D'

    this.subscription = {
      admin_id: this.adminUser_id,
      manager_ids: [this.adminUser_id],
      _id: this.subscription_id,
    }

    this.SubscriptionLocator = {
      getUsersSubscription: sinon.stub(),
      getSubscriptionByMemberIdAndId: sinon.stub(),
      getSubscription: sinon.stub().callsArgWith(1, null, this.subscription),
    }

    this.UserCreator = {
      getUserOrCreateHoldingAccount: sinon
        .stub()
        .callsArgWith(1, null, this.user),
    }

    this.SubscriptionUpdater = {
      removeUserFromGroup: sinon.stub().callsArgWith(2),
      getSubscription: sinon.stub().callsArgWith(2),
    }

    this.TeamInvitesHandler = { createInvite: sinon.stub().callsArgWith(2) }

    this.UserGetter = {
      getUser: sinon.stub(),
      getUserByAnyEmail: sinon.stub(),
    }

    this.LimitationsManager = { hasGroupMembersLimitReached: sinon.stub() }

    this.OneTimeTokenHandler = {
      getValueFromTokenAndExpire: sinon.stub(),
      getNewToken: sinon.stub(),
    }

    this.EmailHandler = { sendEmail: sinon.stub() }

    this.Subscription = {
      updateOne: sinon.stub().yields(),
      updateMany: sinon.stub().yields(),
      findOne: sinon.stub().yields(),
    }

    this.settings = { siteUrl: 'http://www.sharelatex.com' }

    this.readStub = sinon.stub()
    this.NotificationsBuilder = {
      groupPlan: sinon.stub().returns({ read: this.readStub }),
    }

    this.UserMembershipViewModel = {
      build(email) {
        return { email }
      },
    }

    this.Handler = SandboxedModule.require(modulePath, {
      requires: {
        '../User/UserCreator': this.UserCreator,
        './SubscriptionUpdater': this.SubscriptionUpdater,
        './SubscriptionLocator': this.SubscriptionLocator,
        '../../models/Subscription': {
          Subscription: this.Subscription,
        },
        '../User/UserGetter': this.UserGetter,
        './LimitationsManager': this.LimitationsManager,
        '../Security/OneTimeTokenHandler': this.OneTimeTokenHandler,
        '../Email/EmailHandler': this.EmailHandler,
        '@overleaf/settings': this.settings,
        '../Notifications/NotificationsBuilder': this.NotificationsBuilder,
        '../UserMembership/UserMembershipViewModel':
          this.UserMembershipViewModel,
      },
    })
  })

  describe('removeUserFromGroup', function () {
    it('should call the subscription updater to remove the user', function (done) {
      this.Handler.removeUserFromGroup(
        this.adminUser_id,
        this.user._id,
        err => {
          if (err) return done(err)
          this.SubscriptionUpdater.removeUserFromGroup
            .calledWith(this.adminUser_id, this.user._id)
            .should.equal(true)
          done()
        }
      )
    })
  })

  describe('replaceUserReferencesInGroups', function () {
    beforeEach(function (done) {
      this.oldId = 'ba5eba11'
      this.newId = '5ca1ab1e'
      this.Handler.replaceUserReferencesInGroups(this.oldId, this.newId, () =>
        done()
      )
    })

    it('replaces the admin_id', function () {
      this.Subscription.updateOne
        .calledWith({ admin_id: this.oldId }, { admin_id: this.newId })
        .should.equal(true)
    })

    it('replaces the manager_ids', function () {
      this.Subscription.updateMany
        .calledWith(
          { manager_ids: 'ba5eba11' },
          { $addToSet: { manager_ids: '5ca1ab1e' } }
        )
        .should.equal(true)

      this.Subscription.updateMany
        .calledWith(
          { manager_ids: 'ba5eba11' },
          { $pull: { manager_ids: 'ba5eba11' } }
        )
        .should.equal(true)
    })

    it('replaces the member ids', function () {
      this.Subscription.updateMany
        .calledWith(
          { member_ids: this.oldId },
          { $addToSet: { member_ids: this.newId } }
        )
        .should.equal(true)

      this.Subscription.updateMany
        .calledWith(
          { member_ids: this.oldId },
          { $pull: { member_ids: this.oldId } }
        )
        .should.equal(true)
    })
  })

  describe('isUserPartOfGroup', function () {
    beforeEach(function () {
      this.subscription_id = '123ed13123'
    })

    it('should return true when user is part of subscription', function (done) {
      this.SubscriptionLocator.getSubscriptionByMemberIdAndId.callsArgWith(
        2,
        null,
        { _id: this.subscription_id }
      )
      this.Handler.isUserPartOfGroup(
        this.user_id,
        this.subscription_id,
        (err, partOfGroup) => {
          if (err) return done(err)
          partOfGroup.should.equal(true)
          done()
        }
      )
    })

    it('should return false when no subscription is found', function (done) {
      this.SubscriptionLocator.getSubscriptionByMemberIdAndId.callsArgWith(
        2,
        null
      )
      this.Handler.isUserPartOfGroup(
        this.user_id,
        this.subscription_id,
        (err, partOfGroup) => {
          if (err) return done(err)
          partOfGroup.should.equal(false)
          done()
        }
      )
    })
  })

  describe('getTotalConfirmedUsersInGroup', function () {
    describe('for existing subscriptions', function () {
      beforeEach(function () {
        this.subscription.member_ids = ['12321', '3121321']
      })
      it('should call the subscription locator and return 2 users', function (done) {
        this.Handler.getTotalConfirmedUsersInGroup(
          this.subscription_id,
          (err, count) => {
            if (err) return done(err)
            this.SubscriptionLocator.getSubscription
              .calledWith(this.subscription_id)
              .should.equal(true)
            count.should.equal(2)
            done()
          }
        )
      })
    })
    describe('for nonexistent subscriptions', function () {
      it('should return undefined', function (done) {
        this.Handler.getTotalConfirmedUsersInGroup('fake-id', (err, count) => {
          if (err) return done(err)
          expect(count).not.to.exist
          done()
        })
      })
    })
  })
})
