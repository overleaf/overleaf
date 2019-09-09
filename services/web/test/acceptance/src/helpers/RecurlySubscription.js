const { ObjectId } = require('../../../../app/src/infrastructure/mongojs')
const Subscription = require('./Subscription')
const MockRecurlyApi = require('./MockRecurlyApi')
const RecurlyWrapper = require('../../../../app/src/Features/Subscription/RecurlyWrapper')

class RecurlySubscription {
  constructor(options = {}) {
    this.subscription = new Subscription(options)

    this.uuid = ObjectId().toString()
    this.accountId = this.subscription.admin_id.toString()
    this.state = options.state || 'active'
  }

  ensureExists(callback) {
    this.subscription.ensureExists(error => {
      if (error) {
        return callback(error)
      }
      MockRecurlyApi.addSubscription({
        uuid: this.uuid,
        account_id: this.accountId,
        state: this.state
      })
      MockRecurlyApi.addAccount({ id: this.accountId })
      callback()
    })
  }

  buildCallbackXml() {
    return RecurlyWrapper._buildXml('expired_subscription_notification', {
      subscription: {
        uuid: this.uuid
      }
    })
  }
}

module.exports = RecurlySubscription
