import AbstractMockApi from './AbstractMockApi.mjs'
import SubscriptionController from '../../../../app/src/Features/Subscription/SubscriptionController.mjs'
import { xmlResponse } from '../../../../app/src/infrastructure/Response.mjs'
import { parseReq, z, zz } from '@overleaf/validation-tools'

// Recurly's own ids: subscription uuids and coupon codes are opaque
// Recurly-assigned strings, not Mongo ObjectIds -- only the account "id" is
// ours (it's always set to the Overleaf user's Mongo id, see
// RecurlyWrapper.mjs's `accounts/${userId}` calls).
const subscriptionParamsSchema = z.object({
  params: z.strictObject({ id: z.string() }),
})

const accountParamsSchema = z.object({
  params: z.strictObject({ id: zz.objectId() }),
})

// Mirrors RecurlyWrapper.updateAccountEmailAddress, the sole production
// caller of this route: it PUTs `<account><email>...</email></account>`,
// which recurlyNotificationParser parses into { account: { email } }.
const updateAccountSchema = z.object({
  params: z.strictObject({ id: zz.objectId() }),
  body: z.strictObject({
    account: z.strictObject({
      email: z.string(),
    }),
  }),
})

const couponParamsSchema = z.object({
  params: z.strictObject({ code: z.string() }),
})

class MockRecurlyApi extends AbstractMockApi {
  reset() {
    this.mockSubscriptions = []
    this.redemptions = {}
    this.coupons = {}
    this.rateLimitResetSeconds = Math.ceil(
      (Date.now() + 24 * 60 * 60 * 1000) / 1000
    )
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

  getRateLimitHeaders() {
    return {
      'X-RateLimit-Limit': 1000,
      'X-RateLimit-Remaining': 999,
      'X-RateLimit-Reset': this.rateLimitResetSeconds,
    }
  }

  applyRoutes() {
    this.app.use((req, res, next) => {
      for (const [name, v] of Object.entries(this.getRateLimitHeaders())) {
        res.setHeader(name, v)
      }
      next()
    })
    this.app.get('/subscriptions/:id', (req, res) => {
      const { params } = parseReq(req, subscriptionParamsSchema)
      const subscription = this.getMockSubscriptionById(params.id)
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
      const { params } = parseReq(req, accountParamsSchema)
      const subscription = this.getMockSubscriptionByAccountId(params.id)
      if (!subscription) {
        res.sendStatus(404)
      } else {
        xmlResponse(
          res,
          `\
<account>
	<account_code>${params.id}</account_code>
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
        const { params, body } = parseReq(req, updateAccountSchema)
        const subscription = this.getMockSubscriptionByAccountId(params.id)
        if (!subscription) {
          res.sendStatus(404)
        } else {
          Object.assign(subscription.account, body.account)
          xmlResponse(
            res,
            `\
<account>
	<account_code>${params.id}</account_code>
	<email>${subscription.account.email}</email>
</account>\
`
          )
        }
      }
    )

    this.app.get('/coupons/:code', (req, res) => {
      const { params } = parseReq(req, couponParamsSchema)
      const coupon = this.coupons[params.code]
      if (!coupon) {
        res.sendStatus(404)
      } else {
        xmlResponse(
          res,
          `\
<coupon>
	<coupon_code>${params.code}</coupon_code>
	<name>${coupon.name || ''}</name>
	<description>${coupon.description || ''}</description>
</coupon>\
`
        )
      }
    })

    this.app.get('/accounts/:id/redemptions', (req, res) => {
      const { params } = parseReq(req, accountParamsSchema)
      const redemptions = this.redemptions[params.id] || []
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
