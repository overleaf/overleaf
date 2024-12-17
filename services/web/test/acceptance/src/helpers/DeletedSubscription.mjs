import { expect } from 'chai'
import MockSubscription from './Subscription.mjs'
import SubscriptionUpdater from '../../../../app/src/Features/Subscription/SubscriptionUpdater.js'
import { Subscription as SubscriptionModel } from '../../../../app/src/models/Subscription.js'
import { DeletedSubscription as DeletedSubscriptionModel } from '../../../../app/src/models/DeletedSubscription.js'

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
    DeletedSubscriptionModel.findOne({
      'subscription._id': this.subscription._id,
    })
      .then(deletedSubscription => {
        expect(deletedSubscription).to.be.null
        SubscriptionModel.findById(this.subscription._id)
          .then(subscription => {
            expect(subscription).to.exist
            expect(subscription._id.toString()).to.equal(
              this.subscription._id.toString()
            )
            expect(subscription.admin_id.toString()).to.equal(
              this.subscription.admin_id.toString()
            )
            callback()
          })
          .catch(callback)
      })
      .catch(callback)
  }
}

export default DeletedSubscription
