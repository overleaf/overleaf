const { db, ObjectId } = require('../../../../app/src/infrastructure/mongodb')
const { expect } = require('chai')
const { promisify } = require('util')
const SubscriptionUpdater = require('../../../../app/src/Features/Subscription/SubscriptionUpdater')
const PermissionsManager = require('../../../../app/src/Features/Authorization/PermissionsManager')
const SSOConfigManager = require('../../../../modules/group-settings/app/src/sso/SSOConfigManager')
const SubscriptionModel =
  require('../../../../app/src/models/Subscription').Subscription
const DeletedSubscriptionModel =
  require('../../../../app/src/models/DeletedSubscription').DeletedSubscription
const Modules = require('../../../../app/src/infrastructure/Modules')

class Subscription {
  constructor(options = {}) {
    this.admin_id = options.adminId || new ObjectId()
    this.overleaf = options.overleaf || {}
    this.groupPlan = options.groupPlan
    this.manager_ids = options.managerIds || [this.admin_id]
    this.member_ids = options.memberIds || []
    this.membersLimit = options.membersLimit || 0
    this.invited_emails = options.invitedEmails || []
    this.teamName = options.teamName
    this.teamInvites = options.teamInvites || []
    this.planCode = options.planCode
    this.recurlySubscription_id = options.recurlySubscription_id
    this.features = options.features
    this.ssoConfig = options.ssoConfig
    this.groupPolicy = options.groupPolicy
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
    db.subscriptions.findOne({ _id: new ObjectId(this._id) }, callback)
  }

  getWithGroupPolicy(callback) {
    SubscriptionModel.findById(this._id).populate('groupPolicy').exec(callback)
  }

  setManagerIds(managerIds, callback) {
    return SubscriptionModel.findOneAndUpdate(
      { _id: new ObjectId(this._id) },
      { manager_ids: managerIds },
      callback
    )
  }

  setSSOConfig(ssoConfig, callback) {
    this.get((err, subscription) => {
      if (err) {
        return callback(err)
      }
      SSOConfigManager.promises
        .updateSubscriptionSSOConfig(subscription, ssoConfig)
        .then(result => callback(null, result))
        .catch(error => callback(error))
    })
  }

  refreshUsersFeatures(callback) {
    SubscriptionUpdater.refreshUsersFeatures(this, callback)
  }

  enableManagedUsers(callback) {
    Modules.hooks.fire('enableManagedUsers', this._id, callback)
  }

  enableFeatureSSO(callback) {
    SubscriptionModel.findOneAndUpdate(
      { _id: new ObjectId(this._id) },
      { 'features.groupSSO': true },
      callback
    )
  }

  setValidatedSSO(callback) {
    db.subscriptions.findOne({ _id: new ObjectId(this._id) }, (error, doc) => {
      if (error) {
        return callback(error)
      }
      const ssoConfigId = doc.ssoConfig

      db.ssoConfigs.findOneAndUpdate(
        { _id: ssoConfigId },
        { $set: { validated: true } },
        callback
      )
    })
  }

  setValidatedAndEnabledSSO(callback) {
    db.subscriptions.findOne({ _id: new ObjectId(this._id) }, (error, doc) => {
      if (error) {
        return callback(error)
      }
      const ssoConfigId = doc.ssoConfig

      db.ssoConfigs.findOneAndUpdate(
        { _id: ssoConfigId },
        { $set: { enabled: true, validated: true } },
        callback
      )
    })
  }

  getEnrollmentForUser(user, callback) {
    Modules.hooks.fire(
      'getManagedUsersEnrollmentForUser',
      user,
      (error, [enrollment]) => {
        callback(error, enrollment)
      }
    )
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
      Modules.hooks.fire(
        'enrollInManagedSubscription',
        user._id,
        subscription,
        callback
      )
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

  addMember(userId, callback) {
    return SubscriptionModel.findOneAndUpdate(
      { _id: new ObjectId(this._id) },
      { $push: { member_ids: userId } },
      callback
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

Subscription.promises.prototype.inviteUser = async function (adminUser, email) {
  await adminUser.login()
  return await adminUser.doRequest('POST', {
    url: `/manage/groups/${this._id}/invites`,
    json: {
      email,
    },
  })
}

module.exports = Subscription
