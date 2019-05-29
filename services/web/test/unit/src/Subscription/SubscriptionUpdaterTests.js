/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const should = require('chai').should()
const { expect } = require('chai')
const sinon = require('sinon')
const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionUpdater'
const { assert } = require('chai')
const { ObjectId } = require('mongoose').Types

describe('SubscriptionUpdater', function() {
  beforeEach(function() {
    let subscription
    this.recurlySubscription = {
      uuid: '1238uoijdasjhd',
      plan: {
        plan_code: 'kjhsakjds'
      }
    }
    this.adminUser = { _id: (this.adminuser_id = '5208dd34438843e2db000007') }
    this.otherUserId = '5208dd34438842e2db000005'
    this.allUserIds = ['13213', 'dsadas', 'djsaiud89']
    this.userStub = {
      _id: 'mock-user-stub-id',
      email: 'mock-stub-email@baz.com'
    }
    this.subscription = subscription = {
      _id: '111111111111111111111111',
      admin_id: this.adminUser._id,
      manager_ids: [this.adminUser._id],
      member_ids: this.allUserIds,
      save: sinon.stub().callsArgWith(0),
      planCode: 'student_or_something'
    }
    this.user_id = this.adminuser_id

    this.groupSubscription = {
      _id: '222222222222222222222222',
      admin_id: this.adminUser._id,
      manager_ids: [this.adminUser._id],
      member_ids: this.allUserIds,
      save: sinon.stub().callsArgWith(0),
      planCode: 'group_subscription'
    }

    this.updateStub = sinon.stub().callsArgWith(2, null)
    this.updateManyStub = sinon.stub().callsArgWith(2, null)
    this.findAndModifyStub = sinon
      .stub()
      .callsArgWith(2, null, this.subscription)
    this.SubscriptionModel = (function() {
      const Cls = class {
        static initClass() {
          this.remove = sinon.stub().yields()
        }
        constructor(opts) {
          subscription.admin_id = opts.admin_id
          subscription.manager_ids = [opts.admin_id]
          return subscription
        }
      }
      Cls.initClass()
      return Cls
    })()
    this.SubscriptionModel.update = this.updateStub
    this.SubscriptionModel.updateMany = this.updateManyStub
    this.SubscriptionModel.findAndModify = this.findAndModifyStub

    this.SubscriptionLocator = {
      getUsersSubscription: sinon.stub(),
      getGroupSubscriptionMemberOf: sinon.stub(),
      getMemberSubscriptions: sinon.stub().yields(null, [])
    }

    this.Settings = {
      defaultPlanCode: 'personal',
      defaultFeatures: { default: 'features' }
    }

    this.UserFeaturesUpdater = { updateFeatures: sinon.stub().yields() }

    this.PlansLocator = { findLocalPlanInSettings: sinon.stub().returns({}) }

    this.UserGetter = {
      getUsers(memberIds, projection, callback) {
        const users = memberIds.map(id => ({ _id: id }))
        return callback(null, users)
      },
      getUserOrUserStubById: sinon.stub()
    }

    this.ReferalFeatures = { getBonusFeatures: sinon.stub().callsArgWith(1) }
    this.Modules = { hooks: { fire: sinon.stub().callsArgWith(2, null, null) } }
    return (this.SubscriptionUpdater = SandboxedModule.require(modulePath, {
      requires: {
        '../../models/Subscription': {
          Subscription: this.SubscriptionModel
        },
        './UserFeaturesUpdater': this.UserFeaturesUpdater,
        './SubscriptionLocator': this.SubscriptionLocator,
        '../User/UserGetter': this.UserGetter,
        './PlansLocator': this.PlansLocator,
        'logger-sharelatex': {
          log() {}
        },
        'settings-sharelatex': this.Settings,
        './FeaturesUpdater': (this.FeaturesUpdater = {})
      }
    }))
  })

  describe('syncSubscription', function() {
    beforeEach(function() {
      this.SubscriptionLocator.getUsersSubscription.callsArgWith(
        1,
        null,
        this.subscription
      )
      return (this.SubscriptionUpdater._updateSubscriptionFromRecurly = sinon
        .stub()
        .callsArgWith(2))
    })

    it('should update the subscription if the user already is admin of one', function(done) {
      this.SubscriptionUpdater._createNewSubscription = sinon.stub()

      return this.SubscriptionUpdater.syncSubscription(
        this.recurlySubscription,
        this.adminUser._id,
        err => {
          this.SubscriptionLocator.getUsersSubscription
            .calledWith(this.adminUser._id)
            .should.equal(true)
          this.SubscriptionUpdater._updateSubscriptionFromRecurly.called.should.equal(
            true
          )
          this.SubscriptionUpdater._updateSubscriptionFromRecurly
            .calledWith(this.recurlySubscription, this.subscription)
            .should.equal(true)
          return done()
        }
      )
    })

    return it('should not call updateFeatures with group subscription if recurly subscription is not expired', function(done) {
      return this.SubscriptionUpdater.syncSubscription(
        this.recurlySubscription,
        this.adminUser._id,
        err => {
          this.SubscriptionLocator.getUsersSubscription
            .calledWith(this.adminUser._id)
            .should.equal(true)
          this.SubscriptionUpdater._updateSubscriptionFromRecurly.called.should.equal(
            true
          )
          this.SubscriptionUpdater._updateSubscriptionFromRecurly
            .calledWith(this.recurlySubscription, this.subscription)
            .should.equal(true)
          this.UserFeaturesUpdater.updateFeatures.called.should.equal(false)
          return done()
        }
      )
    })
  })

  describe('_updateSubscriptionFromRecurly', function() {
    beforeEach(function() {
      this.FeaturesUpdater.refreshFeatures = sinon.stub().callsArgWith(1)
      return (this.SubscriptionUpdater.deleteSubscription = sinon
        .stub()
        .yields())
    })

    it('should update the subscription with token etc when not expired', function(done) {
      return this.SubscriptionUpdater._updateSubscriptionFromRecurly(
        this.recurlySubscription,
        this.subscription,
        err => {
          this.subscription.recurlySubscription_id.should.equal(
            this.recurlySubscription.uuid
          )
          this.subscription.planCode.should.equal(
            this.recurlySubscription.plan.plan_code
          )
          this.subscription.save.called.should.equal(true)
          this.FeaturesUpdater.refreshFeatures
            .calledWith(this.adminUser._id)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should remove the subscription when expired', function(done) {
      this.recurlySubscription.state = 'expired'
      return this.SubscriptionUpdater._updateSubscriptionFromRecurly(
        this.recurlySubscription,
        this.subscription,
        err => {
          this.SubscriptionUpdater.deleteSubscription
            .calledWith(this.subscription._id)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should update all the users features', function(done) {
      return this.SubscriptionUpdater._updateSubscriptionFromRecurly(
        this.recurlySubscription,
        this.subscription,
        err => {
          this.FeaturesUpdater.refreshFeatures
            .calledWith(this.adminUser._id)
            .should.equal(true)
          this.FeaturesUpdater.refreshFeatures
            .calledWith(this.allUserIds[0])
            .should.equal(true)
          this.FeaturesUpdater.refreshFeatures
            .calledWith(this.allUserIds[1])
            .should.equal(true)
          this.FeaturesUpdater.refreshFeatures
            .calledWith(this.allUserIds[2])
            .should.equal(true)
          return done()
        }
      )
    })

    it('should set group to true and save how many members can be added to group', function(done) {
      this.PlansLocator.findLocalPlanInSettings
        .withArgs(this.recurlySubscription.plan.plan_code)
        .returns({ groupPlan: true, membersLimit: 5 })
      return this.SubscriptionUpdater._updateSubscriptionFromRecurly(
        this.recurlySubscription,
        this.subscription,
        err => {
          this.subscription.membersLimit.should.equal(5)
          this.subscription.groupPlan.should.equal(true)
          return done()
        }
      )
    })

    return it('should not set group to true or set groupPlan', function(done) {
      return this.SubscriptionUpdater._updateSubscriptionFromRecurly(
        this.recurlySubscription,
        this.subscription,
        err => {
          assert.notEqual(this.subscription.membersLimit, 5)
          assert.notEqual(this.subscription.groupPlan, true)
          return done()
        }
      )
    })
  })

  describe('_createNewSubscription', () =>
    it('should create a new subscription then update the subscription', function(done) {
      return this.SubscriptionUpdater._createNewSubscription(
        this.adminUser._id,
        () => {
          this.subscription.admin_id.should.equal(this.adminUser._id)
          this.subscription.manager_ids.should.deep.equal([this.adminUser._id])
          this.subscription.save.called.should.equal(true)
          return done()
        }
      )
    }))

  describe('addUserToGroup', function() {
    beforeEach(function() {
      return (this.SubscriptionUpdater.addUsersToGroup = sinon
        .stub()
        .yields(null))
    })

    return it('delegates to addUsersToGroup', function(done) {
      return this.SubscriptionUpdater.addUserToGroup(
        this.subscription._id,
        this.otherUserId,
        () => {
          this.SubscriptionUpdater.addUsersToGroup
            .calledWith(this.subscription._id, [this.otherUserId])
            .should.equal(true)
          return done()
        }
      )
    })
  })

  describe('addUsersToGroup', function() {
    beforeEach(function() {
      return (this.FeaturesUpdater.refreshFeatures = sinon
        .stub()
        .callsArgWith(1))
    })

    it('should add the user ids to the group as a set', function(done) {
      return this.SubscriptionUpdater.addUsersToGroup(
        this.subscription._id,
        [this.otherUserId],
        () => {
          const searchOps = { _id: this.subscription._id }
          const insertOperation = {
            $addToSet: { member_ids: { $each: [this.otherUserId] } }
          }
          this.findAndModifyStub
            .calledWith(searchOps, insertOperation)
            .should.equal(true)
          return done()
        }
      )
    })

    return it('should update the users features', function(done) {
      return this.SubscriptionUpdater.addUserToGroup(
        this.subscription._id,
        this.otherUserId,
        () => {
          this.FeaturesUpdater.refreshFeatures
            .calledWith(this.otherUserId)
            .should.equal(true)
          return done()
        }
      )
    })
  })

  describe('removeUserFromGroups', function() {
    beforeEach(function() {
      this.FeaturesUpdater.refreshFeatures = sinon.stub().callsArgWith(1)
      this.UserGetter.getUserOrUserStubById.yields(null, {}, false)
      this.fakeSubscriptions = [{ _id: 'fake-id-1' }, { _id: 'fake-id-2' }]
      return this.SubscriptionLocator.getMemberSubscriptions.yields(
        null,
        this.fakeSubscriptions
      )
    })

    it('should pull the users id from the group', function(done) {
      return this.SubscriptionUpdater.removeUserFromGroup(
        this.subscription._id,
        this.otherUserId,
        () => {
          const searchOps = { _id: this.subscription._id }
          const removeOperation = { $pull: { member_ids: this.otherUserId } }
          this.updateManyStub
            .calledWith(searchOps, removeOperation)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should pull the users id from all groups', function(done) {
      return this.SubscriptionUpdater.removeUserFromAllGroups(
        this.otherUserId,
        () => {
          const filter = { _id: ['fake-id-1', 'fake-id-2'] }
          const removeOperation = { $pull: { member_ids: this.otherUserId } }
          sinon.assert.calledWith(this.updateManyStub, filter, removeOperation)
          return done()
        }
      )
    })

    it('should update the users features', function(done) {
      return this.SubscriptionUpdater.removeUserFromGroup(
        this.subscription._id,
        this.otherUserId,
        () => {
          this.FeaturesUpdater.refreshFeatures
            .calledWith(this.otherUserId)
            .should.equal(true)
          return done()
        }
      )
    })

    return it('should not update features for user stubs', function(done) {
      this.UserGetter.getUserOrUserStubById.yields(null, {}, true)
      return this.SubscriptionUpdater.removeUserFromGroup(
        this.subscription._id,
        this.userStub._id,
        () => {
          this.FeaturesUpdater.refreshFeatures.called.should.equal(false)
          return done()
        }
      )
    })
  })

  return describe('deleteSubscription', function() {
    beforeEach(function(done) {
      this.subscription_id = ObjectId().toString()
      this.subscription = {
        mock: 'subscription',
        admin_id: ObjectId(),
        member_ids: [ObjectId(), ObjectId(), ObjectId()]
      }
      this.SubscriptionLocator.getSubscription = sinon
        .stub()
        .yields(null, this.subscription)
      this.FeaturesUpdater.refreshFeatures = sinon.stub().yields()
      return this.SubscriptionUpdater.deleteSubscription(
        this.subscription_id,
        done
      )
    })

    it('should look up the subscription', function() {
      return this.SubscriptionLocator.getSubscription
        .calledWith(this.subscription_id)
        .should.equal(true)
    })

    it('should remove the subscription', function() {
      return this.SubscriptionModel.remove
        .calledWith({ _id: ObjectId(this.subscription_id) })
        .should.equal(true)
    })

    it('should downgrade the admin_id', function() {
      return this.FeaturesUpdater.refreshFeatures
        .calledWith(this.subscription.admin_id)
        .should.equal(true)
    })

    return it('should downgrade all of the members', function() {
      return Array.from(this.subscription.member_ids).map(user_id =>
        this.FeaturesUpdater.refreshFeatures
          .calledWith(user_id)
          .should.equal(true)
      )
    })
  })
})
