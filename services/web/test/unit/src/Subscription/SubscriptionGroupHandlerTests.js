/* eslint-disable
    handle-callback-err,
    max-len,
    no-dupe-keys,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const should = require('chai').should()
const sinon = require('sinon')
const { assert } = require('chai')
const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionGroupHandler'

describe('SubscriptionGroupHandler', function() {
  beforeEach(function() {
    this.adminUser_id = '12321'
    this.newEmail = 'bob@smith.com'
    this.user_id = '3121321'
    this.email = 'jim@example.com'
    this.user = { _id: this.user_id, email: this.newEmail }
    this.subscription_id = '31DSd1123D'

    this.subscription = {
      admin_id: this.adminUser_id,
      manager_ids: [this.adminUser_id],
      _id: this.subscription_id
    }

    this.SubscriptionLocator = {
      getUsersSubscription: sinon.stub(),
      getSubscriptionByMemberIdAndId: sinon.stub(),
      getSubscription: sinon.stub().callsArgWith(1, null, this.subscription)
    }

    this.UserCreator = {
      getUserOrCreateHoldingAccount: sinon
        .stub()
        .callsArgWith(1, null, this.user)
    }

    this.SubscriptionUpdater = {
      removeUserFromGroup: sinon.stub().callsArgWith(2),
      getSubscription: sinon.stub().callsArgWith(2)
    }

    this.TeamInvitesHandler = { createInvite: sinon.stub().callsArgWith(2) }

    this.UserGetter = {
      getUser: sinon.stub(),
      getUserByAnyEmail: sinon.stub()
    }

    this.LimitationsManager = { hasGroupMembersLimitReached: sinon.stub() }

    this.OneTimeTokenHandler = {
      getValueFromTokenAndExpire: sinon.stub(),
      getNewToken: sinon.stub()
    }

    this.EmailHandler = { sendEmail: sinon.stub() }

    this.Subscription = {
      update: sinon.stub().yields(),
      findOne: sinon.stub().yields()
    }

    this.settings = { siteUrl: 'http://www.sharelatex.com' }

    this.readStub = sinon.stub()
    this.NotificationsBuilder = {
      groupPlan: sinon.stub().returns({ read: this.readStub })
    }

    this.UserMembershipViewModel = {
      build(email) {
        return { email }
      }
    }

    return (this.Handler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'logger-sharelatex': {
          log() {}
        },
        '../User/UserCreator': this.UserCreator,
        './SubscriptionUpdater': this.SubscriptionUpdater,
        './SubscriptionLocator': this.SubscriptionLocator,
        '../../models/Subscription': {
          Subscription: this.Subscription
        },
        '../User/UserGetter': this.UserGetter,
        './LimitationsManager': this.LimitationsManager,
        '../Security/OneTimeTokenHandler': this.OneTimeTokenHandler,
        '../Email/EmailHandler': this.EmailHandler,
        'settings-sharelatex': this.settings,
        '../Notifications/NotificationsBuilder': this.NotificationsBuilder,
        '../UserMembership/UserMembershipViewModel': this
          .UserMembershipViewModel,
        'logger-sharelatex': {
          err() {},
          log() {},
          warn() {}
        }
      }
    }))
  })

  describe('removeUserFromGroup', function() {
    it('should call the subscription updater to remove the user', function(done) {
      return this.Handler.removeUserFromGroup(
        this.adminUser_id,
        this.user._id,
        err => {
          this.SubscriptionUpdater.removeUserFromGroup
            .calledWith(this.adminUser_id, this.user._id)
            .should.equal(true)
          return done()
        }
      )
    })
  })

  describe('replaceUserReferencesInGroups', function() {
    beforeEach(function(done) {
      this.oldId = 'ba5eba11'
      this.newId = '5ca1ab1e'
      return this.Handler.replaceUserReferencesInGroups(
        this.oldId,
        this.newId,
        () => done()
      )
    })

    it('replaces the admin_id', function() {
      return this.Subscription.update
        .calledWith({ admin_id: this.oldId }, { admin_id: this.newId })
        .should.equal(true)
    })

    it('replaces the manager_ids', function() {
      this.Subscription.update
        .calledWith(
          { manager_ids: 'ba5eba11' },
          { $addToSet: { manager_ids: '5ca1ab1e' } },
          { multi: true }
        )
        .should.equal(true)

      return this.Subscription.update
        .calledWith(
          { manager_ids: 'ba5eba11' },
          { $pull: { manager_ids: 'ba5eba11' } },
          { multi: true }
        )
        .should.equal(true)
    })

    it('replaces the member ids', function() {
      this.Subscription.update
        .calledWith(
          { member_ids: this.oldId },
          { $addToSet: { member_ids: this.newId } }
        )
        .should.equal(true)

      return this.Subscription.update
        .calledWith(
          { member_ids: this.oldId },
          { $pull: { member_ids: this.oldId } }
        )
        .should.equal(true)
    })
  })

  describe('isUserPartOfGroup', function() {
    beforeEach(function() {
      return (this.subscription_id = '123ed13123')
    })

    it('should return true when user is part of subscription', function(done) {
      this.SubscriptionLocator.getSubscriptionByMemberIdAndId.callsArgWith(
        2,
        null,
        { _id: this.subscription_id }
      )
      return this.Handler.isUserPartOfGroup(
        this.user_id,
        this.subscription_id,
        (err, partOfGroup) => {
          partOfGroup.should.equal(true)
          return done()
        }
      )
    })

    it('should return false when no subscription is found', function(done) {
      this.SubscriptionLocator.getSubscriptionByMemberIdAndId.callsArgWith(
        2,
        null
      )
      return this.Handler.isUserPartOfGroup(
        this.user_id,
        this.subscription_id,
        (err, partOfGroup) => {
          partOfGroup.should.equal(false)
          return done()
        }
      )
    })
  })

  describe('getTotalConfirmedUsersInGroup', function() {
    describe('for existing subscriptions', function() {
      beforeEach(function() {
        return (this.subscription.member_ids = ['12321', '3121321'])
      })
      it('should call the subscription locator and return 2 users', function(done) {
        return this.Handler.getTotalConfirmedUsersInGroup(
          this.subscription_id,
          (err, count) => {
            this.SubscriptionLocator.getSubscription
              .calledWith(this.subscription_id)
              .should.equal(true)
            count.should.equal(2)
            return done()
          }
        )
      })
    })
    describe('for nonexistent subscriptions', function() {
      it('should return undefined', function(done) {
        return this.Handler.getTotalConfirmedUsersInGroup(
          'fake-id',
          (err, count) => {
            should.not.exist(count)
            return done()
          }
        )
      })
    })
  })
})
