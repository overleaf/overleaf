import AbstractMockApi from './AbstractMockApi.mjs'
import SubscriptionController from '../../../../app/src/Features/Subscription/SubscriptionController.js'
import { xmlResponse } from '../../../../app/src/infrastructure/Response.js'

class MockRecurlyApi extends AbstractMockApi {
  reset() {
    this.mockSubscriptions = []
    this.redemptions = {}
    this.coupons = {}
  }

  addMockSubscription(recurlySubscription) {
    this.mockSubscriptions.push(recurlySubscription)
  }

  getMockSubscriptionByAccountId(accountId) {
    return this.mockSubscriptions.find(
      mockSubscription => mockSubscription.account.id === accountId
    )
  }

  getMockSubscriptionById(uuid) {
    return this.mockSubscriptions.find(
      mockSubscription => mockSubscription.uuid === uuid
    )
  }

  applyRoutes() {
    this.app.get('/subscriptions/:id', (req, res) => {
      const subscription = this.getMockSubscriptionById(req.params.id)
      if (!subscription) {
        res.sendStatus(404)
      } else {
        xmlResponse(
          res,
          `\
<subscription>
	<plan><plan_code>${subscription.planCode}</plan_code></plan>
	<currency>${subscription.currency}</currency>
	<state>${subscription.state}</state>
	<tax_in_cents type="integer">${subscription.tax_in_cents}</tax_in_cents>
	<tax_rate type="float">${subscription.tax_rate}</tax_rate>
	<current_period_ends_at type="datetime">${subscription.current_period_ends_at}</current_period_ends_at>
	<unit_amount_in_cents type="integer">${subscription.unit_amount_in_cents}</unit_amount_in_cents>
	<account href="accounts/${subscription.account.id}" />
	<trial_ends_at type="datetime">${subscription.trial_ends_at}</trial_ends_at>
</subscription>\
`
        )
      }
    })

    this.app.get('/accounts/:id', (req, res) => {
      const subscription = this.getMockSubscriptionByAccountId(req.params.id)
      if (!subscription) {
        res.sendStatus(404)
      } else {
        xmlResponse(
          res,
          `\
<account>
	<account_code>${req.params.id}</account_code>
	<hosted_login_token>${subscription.account.hosted_login_token}</hosted_login_token>
	<email>${subscription.account.email}</email>
</account>\
`
        )
      }
    })

    this.app.put(
      '/accounts/:id',
      SubscriptionController.recurlyNotificationParser, // required to parse XML requests
      (req, res) => {
        const subscription = this.getMockSubscriptionByAccountId(req.params.id)
        if (!subscription) {
          res.sendStatus(404)
        } else {
          Object.assign(subscription.account, req.body.account)
          xmlResponse(
            res,
            `\
<account>
	<account_code>${req.params.id}</account_code>
	<email>${subscription.account.email}</email>
</account>\
`
          )
        }
      }
    )

    this.app.get('/coupons/:code', (req, res) => {
      const coupon = this.coupons[req.params.code]
      if (!coupon) {
        res.sendStatus(404)
      } else {
        xmlResponse(
          res,
          `\
<coupon>
	<coupon_code>${req.params.code}</coupon_code>
	<name>${coupon.name || ''}</name>
	<description>${coupon.description || ''}</description>
</coupon>\
`
        )
      }
    })

    this.app.get('/accounts/:id/redemptions', (req, res) => {
      const redemptions = this.redemptions[req.params.id] || []
      let redemptionsListXml = ''
      for (const redemption of Array.from(redemptions)) {
        redemptionsListXml += `\
<redemption>
	<state>${redemption.state}</state>
	<coupon_code>${redemption.coupon_code}</coupon_code>
</redemption>\
`
      }

      xmlResponse(
        res,
        `\
<redemptions type="array">
	${redemptionsListXml}
</redemptions>\
`
      )
    })
  }
}

export default MockRecurlyApi

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockRecurlyApi
 * @static
 * @returns {MockRecurlyApi}
 */
