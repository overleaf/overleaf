const { ObjectId } = require('../../../../app/src/infrastructure/mongojs')
const SubscriptionModel = require('../../../../app/src/models/Subscription')
  .Subscription

class Subscription {
  constructor(options = {}) {
    this.overleaf = options.overleaf || {}
    this.groupPlan = options.groupPlan
    this.manager_ids = []
  }

  ensureExists(callback) {
    if (this._id) {
      return callback(null)
    }
    const options = { upsert: true, new: true, setDefaultsOnInsert: true }
    SubscriptionModel.findOneAndUpdate(
      {},
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
}

module.exports = Subscription
