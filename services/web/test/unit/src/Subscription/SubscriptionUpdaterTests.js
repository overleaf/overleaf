const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionUpdater'
const { assert, expect } = require('chai')
const { ObjectId } = require('mongodb')

describe('SubscriptionUpdater', function () {
  beforeEach(function () {
    this.recurlyPlan = { planCode: 'recurly-plan' }
    this.recurlySubscription = {
      uuid: '1238uoijdasjhd',
      plan: {
        plan_code: this.recurlyPlan.planCode,
      },
    }

    this.adminUser = { _id: (this.adminuser_id = '5208dd34438843e2db000007') }
    this.otherUserId = '5208dd34438842e2db000005'
    this.allUserIds = ['13213', 'dsadas', 'djsaiud89']
    this.subscription = {
      _id: '111111111111111111111111',
      admin_id: this.adminUser._id,
      manager_ids: [this.adminUser._id],
      member_ids: [],
      save: sinon.stub().resolves(),
      planCode: 'student_or_something',
    }
    this.user_id = this.adminuser_id

    this.groupSubscription = {
      _id: '222222222222222222222222',
      admin_id: this.adminUser._id,
      manager_ids: [this.adminUser._id],
      member_ids: this.allUserIds,
      save: sinon.stub().resolves(),
      groupPlan: true,
      planCode: 'group_subscription',
    }
    this.betterGroupSubscription = {
      _id: '999999999999999999999999',
      admin_id: this.adminUser._id,
      manager_ids: [this.adminUser._id],
      member_ids: [this.otherUserId],
      save: sinon.stub().resolves(),
      groupPlan: true,
      planCode: 'better_group_subscription',
    }

    const subscription = this.subscription
    this.SubscriptionModel = class {
      constructor(opts) {
        // Always return our mock subscription when creating a new one
        subscription.admin_id = opts.admin_id
        subscription.manager_ids = [opts.admin_id]
        return subscription
      }

      save() {
        return Promise.resolve(subscription)
      }
    }
    this.SubscriptionModel.deleteOne = sinon
      .stub()
      .returns({ exec: sinon.stub().resolves() })
    this.SubscriptionModel.updateOne = sinon
      .stub()
      .returns({ exec: sinon.stub().resolves() })
    this.SubscriptionModel.updateMany = sinon
      .stub()
      .returns({ exec: sinon.stub().resolves() })
    this.SubscriptionModel.findOneAndUpdate = sinon.stub().returns({
      exec: sinon.stub().resolves(this.subscription),
    })

    this.SubscriptionLocator = {
      promises: {
        getUsersSubscription: sinon.stub(),
        getGroupSubscriptionMemberOf: sinon.stub(),
        getMemberSubscriptions: sinon.stub().resolves([]),
        getSubscription: sinon.stub(),
      },
    }

    this.SubscriptionLocator.promises.getSubscription
      .withArgs(this.subscription._id)
      .resolves(this.subscription)

    this.Settings = {
      defaultPlanCode: 'personal',
      defaultFeatures: { default: 'features' },
      plans: [
        this.recurlyPlan,
        { planCode: this.subscription.planCode, features: {} },
        {
          planCode: this.groupSubscription.planCode,
          features: {
            collaborators: 10,
            compileTimeout: 60,
            dropbox: true,
          },
        },
        {
          planCode: this.betterGroupSubscription.planCode,
          features: {
            collaborators: -1,
            compileTimeout: 240,
            dropbox: true,
          },
        },
      ],
    }

    this.UserFeaturesUpdater = {
      promises: {
        updateFeatures: sinon.stub().resolves(),
      },
    }

    this.ReferalFeatures = {
      promises: {
        getBonusFeatures: sinon.stub().resolves(),
      },
    }

    this.FeaturesUpdater = {
      promises: {
        refreshFeatures: sinon.stub().resolves({}),
      },
    }

    this.DeletedSubscription = {
      findOneAndUpdate: sinon.stub().returns({ exec: sinon.stub().resolves() }),
    }

    this.AnalyticsManager = {
      setUserPropertyForUser: sinon.stub(),
    }

    this.SubscriptionUpdater = SandboxedModule.require(modulePath, {
      requires: {
        '../../models/Subscription': {
          Subscription: this.SubscriptionModel,
        },
        './UserFeaturesUpdater': this.UserFeaturesUpdater,
        './SubscriptionLocator': this.SubscriptionLocator,
        '@overleaf/settings': this.Settings,
        '../../infrastructure/mongodb': { db: {}, ObjectId },
        './FeaturesUpdater': this.FeaturesUpdater,
        '../../models/DeletedSubscription': {
          DeletedSubscription: this.DeletedSubscription,
        },
        '../Analytics/AnalyticsManager': this.AnalyticsManager,
      },
    })
  })

  describe('updateAdmin', function () {
    it('should update the subscription admin', async function () {
      this.subscription.groupPlan = true
      await this.SubscriptionUpdater.promises.updateAdmin(
        this.subscription,
        this.otherUserId
      )
      const query = {
        _id: ObjectId(this.subscription._id),
        customAccount: true,
      }
      const update = {
        $set: { admin_id: ObjectId(this.otherUserId) },
        $addToSet: { manager_ids: ObjectId(this.otherUserId) },
      }
      this.SubscriptionModel.updateOne.should.have.been.calledOnce
      this.SubscriptionModel.updateOne.should.have.been.calledWith(
        query,
        update
      )
    })

    it('should remove the manager for non-group subscriptions', async function () {
      await this.SubscriptionUpdater.promises.updateAdmin(
        this.subscription,
        this.otherUserId
      )
      const query = {
        _id: ObjectId(this.subscription._id),
        customAccount: true,
      }
      const update = {
        $set: {
          admin_id: ObjectId(this.otherUserId),
          manager_ids: [ObjectId(this.otherUserId)],
        },
      }
      this.SubscriptionModel.updateOne.should.have.been.calledOnce
      this.SubscriptionModel.updateOne.should.have.been.calledWith(
        query,
        update
      )
    })
  })

  describe('syncSubscription', function () {
    beforeEach(function () {
      this.SubscriptionLocator.promises.getUsersSubscription.resolves(
        this.subscription
      )
    })

    it('should update the subscription if the user already is admin of one', async function () {
      await this.SubscriptionUpdater.promises.syncSubscription(
        this.recurlySubscription,
        this.adminUser._id
      )
      this.SubscriptionLocator.promises.getUsersSubscription
        .calledWith(this.adminUser._id)
        .should.equal(true)
    })

    it('should not call updateFeatures with group subscription if recurly subscription is not expired', async function () {
      await this.SubscriptionUpdater.promises.syncSubscription(
        this.recurlySubscription,
        this.adminUser._id
      )
      this.SubscriptionLocator.promises.getUsersSubscription
        .calledWith(this.adminUser._id)
        .should.equal(true)
      this.UserFeaturesUpdater.promises.updateFeatures.called.should.equal(
        false
      )
    })
  })

  describe('updateSubscriptionFromRecurly', function () {
    afterEach(function () {
      this.subscription.member_ids = []
    })

    it('should update the subscription with token etc when not expired', async function () {
      await this.SubscriptionUpdater.promises.updateSubscriptionFromRecurly(
        this.recurlySubscription,
        this.subscription,
        {}
      )
      this.subscription.recurlySubscription_id.should.equal(
        this.recurlySubscription.uuid
      )
      this.subscription.planCode.should.equal(
        this.recurlySubscription.plan.plan_code
      )
      this.subscription.save.called.should.equal(true)
      this.FeaturesUpdater.promises.refreshFeatures
        .calledWith(this.adminUser._id)
        .should.equal(true)
    })

    it('should remove the subscription when expired', async function () {
      this.recurlySubscription.state = 'expired'
      await this.SubscriptionUpdater.promises.updateSubscriptionFromRecurly(
        this.recurlySubscription,
        this.subscription,
        {}
      )
    })

    it('should update all the users features', async function () {
      this.subscription.member_ids = this.allUserIds
      await this.SubscriptionUpdater.promises.updateSubscriptionFromRecurly(
        this.recurlySubscription,
        this.subscription,
        {}
      )
      this.FeaturesUpdater.promises.refreshFeatures
        .calledWith(this.adminUser._id)
        .should.equal(true)
      this.FeaturesUpdater.promises.refreshFeatures
        .calledWith(this.allUserIds[0])
        .should.equal(true)
      this.FeaturesUpdater.promises.refreshFeatures
        .calledWith(this.allUserIds[1])
        .should.equal(true)
      this.FeaturesUpdater.promises.refreshFeatures
        .calledWith(this.allUserIds[2])
        .should.equal(true)
    })

    it('should set group to true and save how many members can be added to group', async function () {
      this.recurlyPlan.groupPlan = true
      this.recurlyPlan.membersLimit = 5
      await this.SubscriptionUpdater.promises.updateSubscriptionFromRecurly(
        this.recurlySubscription,
        this.subscription,
        {}
      )
      this.subscription.membersLimit.should.equal(5)
      this.subscription.groupPlan.should.equal(true)
      this.subscription.member_ids.should.deep.equal([
        this.subscription.admin_id,
      ])
    })

    it('should delete and replace subscription when downgrading from group to individual plan', async function () {
      this.recurlyPlan.groupPlan = false
      await this.SubscriptionUpdater.promises.updateSubscriptionFromRecurly(
        this.recurlySubscription,
        this.groupSubscription,
        {}
      )
    })

    it('should not set group to true or set groupPlan', async function () {
      await this.SubscriptionUpdater.promises.updateSubscriptionFromRecurly(
        this.recurlySubscription,
        this.subscription,
        {}
      )
      assert.notEqual(this.subscription.membersLimit, 5)
      assert.notEqual(this.subscription.groupPlan, true)
    })

    describe('when the plan allows adding more seats', function () {
      beforeEach(function () {
        this.membersLimitAddOn = 'add_on1'
        this.recurlyPlan.groupPlan = true
        this.recurlyPlan.membersLimit = 5
        this.recurlyPlan.membersLimitAddOn = this.membersLimitAddOn
      })

      function expectMembersLimit(limit) {
        it('should set the membersLimit accordingly', async function () {
          await this.SubscriptionUpdater.promises.updateSubscriptionFromRecurly(
            this.recurlySubscription,
            this.subscription,
            {}
          )
          expect(this.subscription.membersLimit).to.equal(limit)
        })
      }

      describe('when the recurlySubscription does not have add ons', function () {
        beforeEach(function () {
          delete this.recurlySubscription.subscription_add_ons
        })
        expectMembersLimit(5)
      })

      describe('when the recurlySubscription has non-matching add ons', function () {
        beforeEach(function () {
          this.recurlySubscription.subscription_add_ons = [
            { add_on_code: 'add_on_99', quantity: 3 },
          ]
        })
        expectMembersLimit(5)
      })

      describe('when the recurlySubscription has a matching add on', function () {
        beforeEach(function () {
          this.recurlySubscription.subscription_add_ons = [
            { add_on_code: this.membersLimitAddOn, quantity: 10 },
          ]
        })
        expectMembersLimit(15)
      })

      // NOTE: This is unexpected, but we are going to support it anyways.
      describe('when the recurlySubscription has multiple matching add ons', function () {
        beforeEach(function () {
          this.recurlySubscription.subscription_add_ons = [
            { add_on_code: this.membersLimitAddOn, quantity: 10 },
            { add_on_code: this.membersLimitAddOn, quantity: 3 },
          ]
        })
        expectMembersLimit(18)
      })
    })
  })

  describe('addUserToGroup', function () {
    it('should add the user ids to the group as a set', async function () {
      await this.SubscriptionUpdater.promises.addUserToGroup(
        this.subscription._id,
        this.otherUserId
      )
      const searchOps = { _id: this.subscription._id }
      const insertOperation = {
        $addToSet: { member_ids: this.otherUserId },
      }
      this.SubscriptionModel.updateOne
        .calledWith(searchOps, insertOperation)
        .should.equal(true)
    })

    it('should update the users features', async function () {
      await this.SubscriptionUpdater.promises.addUserToGroup(
        this.subscription._id,
        this.otherUserId
      )
      this.FeaturesUpdater.promises.refreshFeatures
        .calledWith(this.otherUserId)
        .should.equal(true)
    })

    it('should set the group plan code user property to the best plan with 1 group subscription', async function () {
      this.SubscriptionLocator.promises.getMemberSubscriptions
        .withArgs(this.otherUserId)
        .resolves([this.groupSubscription])
      await this.SubscriptionUpdater.promises.addUserToGroup(
        this.groupSubscription._id,
        this.otherUserId
      )
      sinon.assert.calledWith(
        this.AnalyticsManager.setUserPropertyForUser,
        this.otherUserId,
        'group-subscription-plan-code',
        'group_subscription'
      )
    })

    it('should set the group plan code user property to the best plan with 2 group subscriptions', async function () {
      this.SubscriptionLocator.promises.getMemberSubscriptions
        .withArgs(this.otherUserId)
        .resolves([this.groupSubscription, this.betterGroupSubscription])
      await this.SubscriptionUpdater.promises.addUserToGroup(
        this.betterGroupSubscription._id,
        this.otherUserId
      )
      sinon.assert.calledWith(
        this.AnalyticsManager.setUserPropertyForUser,
        this.otherUserId,
        'group-subscription-plan-code',
        'better_group_subscription'
      )
    })

    it('should set the group plan code user property to the best plan with 2 group subscriptions in reverse order', async function () {
      this.SubscriptionLocator.promises.getMemberSubscriptions
        .withArgs(this.otherUserId)
        .resolves([this.betterGroupSubscription, this.groupSubscription])
      await this.SubscriptionUpdater.promises.addUserToGroup(
        this.betterGroupSubscription._id,
        this.otherUserId
      )
      sinon.assert.calledWith(
        this.AnalyticsManager.setUserPropertyForUser,
        this.otherUserId,
        'group-subscription-plan-code',
        'better_group_subscription'
      )
    })
  })

  describe('removeUserFromGroups', function () {
    beforeEach(function () {
      this.fakeSubscriptions = [{ _id: 'fake-id-1' }, { _id: 'fake-id-2' }]
      this.SubscriptionLocator.promises.getMemberSubscriptions.resolves(
        this.fakeSubscriptions
      )
    })

    it('should pull the users id from the group', async function () {
      await this.SubscriptionUpdater.promises.removeUserFromGroup(
        this.subscription._id,
        this.otherUserId
      )
      const removeOperation = { $pull: { member_ids: this.otherUserId } }
      this.SubscriptionModel.updateOne
        .calledWith({ _id: this.subscription._id }, removeOperation)
        .should.equal(true)
    })

    it('should set the group plan code user property when removing user from group', async function () {
      await this.SubscriptionUpdater.promises.removeUserFromGroup(
        this.subscription._id,
        this.otherUserId
      )
      sinon.assert.calledWith(
        this.AnalyticsManager.setUserPropertyForUser,
        this.otherUserId,
        'group-subscription-plan-code',
        null
      )
    })

    it('should set the group plan code user property when removing user from all groups', async function () {
      await this.SubscriptionUpdater.promises.removeUserFromAllGroups(
        this.otherUserId
      )
      sinon.assert.calledWith(
        this.AnalyticsManager.setUserPropertyForUser,
        this.otherUserId,
        'group-subscription-plan-code',
        null
      )
    })

    it('should pull the users id from all groups', async function () {
      await this.SubscriptionUpdater.promises.removeUserFromAllGroups(
        this.otherUserId
      )
      const filter = { _id: ['fake-id-1', 'fake-id-2'] }
      const removeOperation = { $pull: { member_ids: this.otherUserId } }
      sinon.assert.calledWith(
        this.SubscriptionModel.updateMany,
        filter,
        removeOperation
      )
    })

    it('should update the users features', async function () {
      await this.SubscriptionUpdater.promises.removeUserFromGroup(
        this.subscription._id,
        this.otherUserId
      )
      this.FeaturesUpdater.promises.refreshFeatures
        .calledWith(this.otherUserId)
        .should.equal(true)
    })
  })

  describe('deleteSubscription', function () {
    beforeEach(async function () {
      this.subscription = {
        _id: ObjectId().toString(),
        mock: 'subscription',
        admin_id: ObjectId(),
        member_ids: [ObjectId(), ObjectId(), ObjectId()],
      }
      await this.SubscriptionUpdater.promises.deleteSubscription(
        this.subscription,
        {}
      )
    })

    it('should remove the subscription', function () {
      this.SubscriptionModel.deleteOne
        .calledWith({ _id: this.subscription._id })
        .should.equal(true)
    })

    it('should downgrade the admin_id', function () {
      this.FeaturesUpdater.promises.refreshFeatures
        .calledWith(this.subscription.admin_id)
        .should.equal(true)
    })

    it('should downgrade all of the members', function () {
      for (const userId of this.subscription.member_ids) {
        this.FeaturesUpdater.promises.refreshFeatures
          .calledWith(userId)
          .should.equal(true)
      }
    })
  })
})
