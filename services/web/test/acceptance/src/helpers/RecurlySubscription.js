const { ObjectId } = require('mongodb-legacy')
const Subscription = require('./Subscription')
const MockRecurlyApiClass = require('../mocks/MockRecurlyApi')
const RecurlyWrapper = require('../../../../app/src/Features/Subscription/RecurlyWrapper')
const { promisifyClass } = require('@overleaf/promise-utils')

let MockRecurlyApi

before(function () {
  MockRecurlyApi = MockRecurlyApiClass.instance()
})

class RecurlySubscription {
  constructor(options = {}) {
    options.recurlySubscription_id = new ObjectId().toString()
    this.subscription = new Subscription(options)

    this.uuid = options.recurlySubscription_id
    this.state = options.state || 'active'
    this.tax_in_cents = 100
    this.tax_rate = 0.2
    this.unit_amount_in_cents = 500
    this.currency = 'GBP'
    this.current_period_ends_at = new Date(2018, 4, 5)
    this.trial_ends_at = new Date(2018, 6, 7)
    this.account = {
      id: this.subscription.admin_id.toString(),
      email: options.account && options.account.email,
      hosted_login_token: options.account && options.account.hosted_login_token,
    }
    this.planCode = options.planCode || 'personal'
  }

  ensureExists(callback) {
    this.subscription.ensureExists(error => {
      if (error) {
        return callback(error)
      }
      MockRecurlyApi.addMockSubscription(this)
      callback()
    })
  }

  buildCallbackXml(event) {
    return RecurlyWrapper._buildXml(event, {
      subscription: {
        uuid: this.uuid,
        state: this.state,
        plan: {
          plan_code: this.planCode,
        },
      },
      account: {
        account_code: this.account.id,
      },
    })
  }
}

module.exports = RecurlySubscription
module.exports.promises = promisifyClass(RecurlySubscription, {
  without: ['buildCallbackXml'],
})
