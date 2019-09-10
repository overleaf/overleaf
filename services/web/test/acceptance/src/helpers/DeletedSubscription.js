const { expect } = require('chai')
const MockSubscription = require('./Subscription')
const SubscriptionUpdater = require('../../../../app/src/Features/Subscription/SubscriptionUpdater')
const SubscriptionModel = require('../../../../app/src/models/Subscription')
  .Subscription
const DeletedSubscriptionModel = require(`../../../../app/src/models/DeletedSubscription`)
  .DeletedSubscription

class DeletedSubscription {
  constructor(options = {}) {
    this.subscription = new MockSubscription(options)
  }

  ensureExists(callback) {
    this.subscription.ensureExists(error => {
      if (error) {
        return callback(error)
      }
      SubscriptionUpdater.deleteSubscription(this.subscription, {}, callback)
    })
  }

  expectRestored(callback) {
    DeletedSubscriptionModel.findOne(
      { 'subscription._id': this.subscription._id },
      (error, deletedSubscription) => {
        if (error) {
          return callback(error)
        }
        expect(deletedSubscription).to.be.null
        SubscriptionModel.findById(
          this.subscription._id,
          (error, subscription) => {
            expect(subscription).to.exists
            expect(subscription._id.toString()).to.equal(
              this.subscription._id.toString()
            )
            expect(subscription.admin_id.toString()).to.equal(
              this.subscription.admin_id.toString()
            )
            callback(error)
          }
        )
      }
    )
  }
}

module.exports = DeletedSubscription
