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
      promises: {
        getUsersSubscription: sinon.stub(),
        getSubscriptionByMemberIdAndId: sinon.stub(),
        getSubscription: sinon.stub().resolves(this.subscription),
      },
    }

    this.SubscriptionUpdater = {
      promises: {
        removeUserFromGroup: sinon.stub().resolves(),
        getSubscription: sinon.stub().resolves(),
      },
    }

    this.Subscription = {
      updateOne: sinon.stub().returns({ exec: sinon.stub().resolves }),
      updateMany: sinon.stub().returns({ exec: sinon.stub().resolves }),
      findOne: sinon.stub().returns({ exec: sinon.stub().resolves }),
    }

    this.Handler = SandboxedModule.require(modulePath, {
      requires: {
        './SubscriptionUpdater': this.SubscriptionUpdater,
        './SubscriptionLocator': this.SubscriptionLocator,
        '../../models/Subscription': {
          Subscription: this.Subscription,
        },
      },
    })
  })

  describe('removeUserFromGroup', function () {
    it('should call the subscription updater to remove the user', async function () {
      await this.Handler.promises.removeUserFromGroup(
        this.adminUser_id,
        this.user._id
      )

      this.SubscriptionUpdater.promises.removeUserFromGroup
        .calledWith(this.adminUser_id, this.user._id)
        .should.equal(true)
    })
  })

  describe('replaceUserReferencesInGroups', function () {
    beforeEach(async function () {
      this.oldId = 'ba5eba11'
      this.newId = '5ca1ab1e'
      await this.Handler.promises.replaceUserReferencesInGroups(
        this.oldId,
        this.newId
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

    it('should return true when user is part of subscription', async function () {
      this.SubscriptionLocator.promises.getSubscriptionByMemberIdAndId.resolves(
        {
          _id: this.subscription_id,
        }
      )
      const partOfGroup = await this.Handler.promises.isUserPartOfGroup(
        this.user_id,
        this.subscription_id
      )
      partOfGroup.should.equal(true)
    })

    it('should return false when no subscription is found', async function () {
      this.SubscriptionLocator.promises.getSubscriptionByMemberIdAndId.resolves(
        null
      )
      const partOfGroup = await this.Handler.promises.isUserPartOfGroup(
        this.user_id,
        this.subscription_id
      )
      partOfGroup.should.equal(false)
    })
  })

  describe('getTotalConfirmedUsersInGroup', function () {
    describe('for existing subscriptions', function () {
      beforeEach(function () {
        this.subscription.member_ids = ['12321', '3121321']
      })
      it('should call the subscription locator and return 2 users', async function () {
        const count = await this.Handler.promises.getTotalConfirmedUsersInGroup(
          this.subscription_id
        )
        this.SubscriptionLocator.promises.getSubscription
          .calledWith(this.subscription_id)
          .should.equal(true)
        count.should.equal(2)
      })
    })
    describe('for nonexistent subscriptions', function () {
      it('should return undefined', async function () {
        const count =
          await this.Handler.promises.getTotalConfirmedUsersInGroup('fake-id')
        expect(count).not.to.exist
      })
    })
  })
})
