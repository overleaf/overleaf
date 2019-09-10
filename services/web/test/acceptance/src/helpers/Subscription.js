const { ObjectId } = require('../../../../app/src/infrastructure/mongojs')
const { expect } = require('chai')
const SubscriptionModel = require('../../../../app/src/models/Subscription')
  .Subscription
const DeletedSubscriptionModel = require(`../../../../app/src/models/DeletedSubscription`)
  .DeletedSubscription

class Subscription {
  constructor(options = {}) {
    this.admin_id = options.adminId || ObjectId()
    this.overleaf = options.overleaf || {}
    this.groupPlan = options.groupPlan
    this.manager_ids = []
    this.member_ids = options.memberIds || []
    this.invited_emails = options.invitedEmails || []
    this.teamInvites = options.teamInvites || []
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
        this._id = subscription._id
        callback(error)
      }
    )
  }

  setManagerIds(managerIds, callback) {
    return SubscriptionModel.findOneAndUpdate(
      { _id: ObjectId(this._id) },
      { manager_ids: managerIds },
      callback
    )
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

module.exports = Subscription
