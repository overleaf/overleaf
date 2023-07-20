const { db, ObjectId } = require('../../../../app/src/infrastructure/mongodb')
const { expect } = require('chai')
const { promisify } = require('util')
const SubscriptionUpdater = require('../../../../app/src/Features/Subscription/SubscriptionUpdater')
const ManagedUsersHandler = require('../../../../app/src/Features/Subscription/ManagedUsersHandler')
const PermissionsManager = require('../../../../app/src/Features/Authorization/PermissionsManager')
const SubscriptionModel =
  require('../../../../app/src/models/Subscription').Subscription
const DeletedSubscriptionModel =
  require(`../../../../app/src/models/DeletedSubscription`).DeletedSubscription

class Subscription {
  constructor(options = {}) {
    this.admin_id = options.adminId || ObjectId()
    this.overleaf = options.overleaf || {}
    this.groupPlan = options.groupPlan
    this.manager_ids = options.managerIds || [this.admin_id]
    this.member_ids = options.memberIds || []
    this.invited_emails = options.invitedEmails || []
    this.teamName = options.teamName
    this.teamInvites = options.teamInvites || []
    this.planCode = options.planCode
    this.recurlySubscription_id = options.recurlySubscription_id
  }

  ensureExists(callback) {
    if (this._id) {
      return callback(null)
    }
    const options = { upsert: true, new: true, setDefaultsOnInsert: true }
    SubscriptionModel.findOneAndUpdate(
      { admin_id: this.admin_id },
      this,
      options,
      (error, subscription) => {
        if (error) {
          return callback(error)
        }
        this._id = subscription._id
        callback()
      }
    )
  }

  get(callback) {
    db.subscriptions.findOne({ _id: ObjectId(this._id) }, callback)
  }

  getWithGroupPolicy(callback) {
    SubscriptionModel.findById(this._id).populate('groupPolicy').exec(callback)
  }

  setManagerIds(managerIds, callback) {
    return SubscriptionModel.findOneAndUpdate(
      { _id: ObjectId(this._id) },
      { manager_ids: managerIds },
      callback
    )
  }

  refreshUsersFeatures(callback) {
    SubscriptionUpdater.refreshUsersFeatures(this, callback)
  }

  enableManagedUsers(callback) {
    ManagedUsersHandler.enableManagedUsers(this._id, callback)
  }

  getEnrollmentForUser(user, callback) {
    ManagedUsersHandler.getEnrollmentForUser(user, callback)
  }

  getCapabilities(groupPolicy) {
    return PermissionsManager.getUserCapabilities(groupPolicy)
  }

  getUserValidationStatus(params, callback) {
    PermissionsManager.getUserValidationStatus(params, callback)
  }

  enrollManagedUser(user, callback) {
    SubscriptionModel.findById(this._id).exec((error, subscription) => {
      if (error) {
        return callback(error)
      }
      ManagedUsersHandler.enrollInSubscription(user._id, subscription, callback)
    })
  }

  expectDeleted(deleterData, callback) {
    DeletedSubscriptionModel.find(
      { 'subscription._id': this._id },
      (error, deletedSubscriptions) => {
        if (error) {
          return callback(error)
        }
        expect(deletedSubscriptions.length).to.equal(1)

        const deletedSubscription = deletedSubscriptions[0]
        expect(deletedSubscription.subscription.teamInvites).to.be.empty
        expect(deletedSubscription.subscription.invited_emails).to.be.empty
        expect(deletedSubscription.deleterData.deleterIpAddress).to.equal(
          deleterData.ip
        )
        if (deleterData.id) {
          expect(deletedSubscription.deleterData.deleterId.toString()).to.equal(
            deleterData.id.toString()
          )
        } else {
          expect(deletedSubscription.deleterData.deleterId).to.be.undefined
        }
        SubscriptionModel.findById(this._id, (error, subscription) => {
          expect(subscription).to.be.null
          callback(error)
        })
      }
    )
  }
}

Subscription.promises = class extends Subscription {}

// promisify User class methods - works for methods with 0-1 output parameters,
// otherwise we will need to implement the method manually instead
const nonPromiseMethods = ['constructor', 'getCapabilities']
Object.getOwnPropertyNames(Subscription.prototype).forEach(methodName => {
  const method = Subscription.prototype[methodName]
  if (typeof method === 'function' && !nonPromiseMethods.includes(methodName)) {
    Subscription.promises.prototype[methodName] = promisify(method)
  }
})

module.exports = Subscription
