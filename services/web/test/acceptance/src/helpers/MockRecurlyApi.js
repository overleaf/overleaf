/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let MockRecurlyApi
const express = require('express')
const app = express()
const bodyParser = require('body-parser')

app.use(bodyParser.json())

module.exports = MockRecurlyApi = {
  subscriptions: {},

  accounts: {},

  redemptions: {},

  coupons: {},

  addSubscription(subscription) {
    this.subscriptions[subscription.uuid] = subscription
  },

  addAccount(account) {
    this.accounts[account.id] = account
  },

  run() {
    app.get('/subscriptions/:id', (req, res, next) => {
      const subscription = this.subscriptions[req.params.id]
      if (subscription == null) {
        return res.status(404).end()
      } else {
        return res.send(`\
<subscription>
	<plan_code>${subscription.plan_code}</plan_code>
	<currency>${subscription.currency}</currency>
	<state>${subscription.state}</state>
	<tax_in_cents type="integer">${subscription.tax_in_cents}</tax_in_cents>
	<tax_rate type="float">${subscription.tax_rate}</tax_rate>
	<current_period_ends_at type="datetime">${
    subscription.current_period_ends_at
  }</current_period_ends_at>
	<unit_amount_in_cents type="integer">${
    subscription.unit_amount_in_cents
  }</unit_amount_in_cents>
	<account href="accounts/${subscription.account_id}" />
	<trial_ends_at type="datetime">${subscription.trial_ends_at}</trial_ends_at>
</subscription>\
`)
      }
    })

    app.get('/accounts/:id', (req, res, next) => {
      const account = this.accounts[req.params.id]
      if (account == null) {
        return res.status(404).end()
      } else {
        return res.send(`\
<account>
	<account_code>${req.params.id}</account_code>
	<hosted_login_token>${account.hosted_login_token}</hosted_login_token>
</account>\
`)
      }
    })

    app.get('/coupons/:code', (req, res, next) => {
      const coupon = this.coupons[req.params.code]
      if (coupon == null) {
        return res.status(404).end()
      } else {
        return res.send(`\
<coupon>
	<coupon_code>${req.params.code}</coupon_code>
	<name>${coupon.name || ''}</name>
	<description>${coupon.description || ''}</description>
</coupon>\
`)
      }
    })

    app.get('/accounts/:id/redemptions', (req, res, next) => {
      const redemptions = this.redemptions[req.params.id] || []
      let redemptionsListXml = ''
      for (let redemption of Array.from(redemptions)) {
        redemptionsListXml += `\
<redemption>
	<state>${redemption.state}</state>
	<coupon_code>${redemption.coupon_code}</coupon_code>
</redemption>\
`
      }

      return res.send(`\
<redemptions type="array">
	${redemptionsListXml}
</redemptions>\
`)
    })

    return app.listen(6034, error => {
      if (error != null) {
        throw error
      }
    })
  }
}

MockRecurlyApi.run()
