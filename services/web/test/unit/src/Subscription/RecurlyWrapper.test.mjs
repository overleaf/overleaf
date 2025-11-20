import { vi, assert, expect } from 'vitest'
import sinon from 'sinon'
import tk from 'timekeeper'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import SubscriptionErrors from '../../../../app/src/Features/Subscription/Errors.mjs'
import { RequestFailedError } from '@overleaf/fetch-utils'
const modulePath = '../../../../app/src/Features/Subscription/RecurlyWrapper'

const fixtures = {
  'subscriptions/44f83d7cba354d5b84812419f923ea96':
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<subscription href="https://api.recurly.com/v2/subscriptions/44f83d7cba354d5b84812419f923ea96">' +
    '  <account href="https://api.recurly.com/v2/accounts/104"/>' +
    '  <plan href="https://api.recurly.com/v2/plans/gold">' +
    '    <plan_code>gold</plan_code>' +
    '    <name>Gold plan</name>' +
    '  </plan>' +
    '  <uuid>44f83d7cba354d5b84812419f923ea96</uuid>' +
    '  <state>active</state>' +
    '  <unit_amount_in_cents type="integer">800</unit_amount_in_cents>' +
    '  <currency>EUR</currency>' +
    '  <quantity type="integer">1</quantity>' +
    '  <activated_at type="datetime">2011-05-27T07:00:00Z</activated_at>' +
    '  <canceled_at nil="nil"></canceled_at>' +
    '  <expires_at nil="nil"></expires_at>' +
    '  <current_period_started_at type="datetime">2011-06-27T07:00:00Z</current_period_started_at>' +
    '  <current_period_ends_at type="datetime">2011-07-27T07:00:00Z</current_period_ends_at>' +
    '  <trial_started_at nil="nil"></trial_started_at>' +
    '  <trial_ends_at nil="nil"></trial_ends_at>' +
    '  <subscription_add_ons type="array">' +
    '    <subscription_add_on>' +
    '      <add_on_code>ipaddresses</add_on_code>' +
    '      <quantity>10</quantity>' +
    '      <unit_amount_in_cents>150</unit_amount_in_cents>' +
    '    </subscription_add_on>' +
    '  </subscription_add_ons>' +
    '  <a name="cancel" href="https://api.recurly.com/v2/subscriptions/44f83d7cba354d5b84812419f923ea96/cancel" method="put"/>' +
    '  <a name="terminate" href="https://api.recurly.com/v2/subscriptions/44f83d7cba354d5b84812419f923ea96/terminate" method="put"/>' +
    '  <a name="postpone" href="https://api.recurly.com/v2/subscriptions/44f83d7cba354d5b84812419f923ea96/postpone" method="put"/>' +
    '</subscription>',
  'recurly_js/result/70db44b10f5f4b238669480c9903f6f5':
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<subscription href="https://api.recurly.com/v2/subscriptions/44f83d7cba354d5b84812419f923ea96">' +
    '  <account href="https://api.recurly.com/v2/accounts/104"/>' +
    '  <plan href="https://api.recurly.com/v2/plans/gold">' +
    '    <plan_code>gold</plan_code>' +
    '    <name>Gold plan</name>' +
    '  </plan>' +
    '  <uuid>44f83d7cba354d5b84812419f923ea96</uuid>' +
    '  <state>active</state>' +
    '  <unit_amount_in_cents type="integer">800</unit_amount_in_cents>' +
    '  <currency>EUR</currency>' +
    '  <quantity type="integer">1</quantity>' +
    '  <activated_at type="datetime">2011-05-27T07:00:00Z</activated_at>' +
    '  <canceled_at nil="nil"></canceled_at>' +
    '  <expires_at nil="nil"></expires_at>' +
    '  <current_period_started_at type="datetime">2011-06-27T07:00:00Z</current_period_started_at>' +
    '  <current_period_ends_at type="datetime">2011-07-27T07:00:00Z</current_period_ends_at>' +
    '  <trial_started_at nil="nil"></trial_started_at>' +
    '  <trial_ends_at nil="nil"></trial_ends_at>' +
    '  <subscription_add_ons type="array">' +
    '    <subscription_add_on>' +
    '      <add_on_code>ipaddresses</add_on_code>' +
    '      <quantity>10</quantity>' +
    '      <unit_amount_in_cents>150</unit_amount_in_cents>' +
    '    </subscription_add_on>' +
    '  </subscription_add_ons>' +
    '  <a name="cancel" href="https://api.recurly.com/v2/subscriptions/44f83d7cba354d5b84812419f923ea96/cancel" method="put"/>' +
    '  <a name="terminate" href="https://api.recurly.com/v2/subscriptions/44f83d7cba354d5b84812419f923ea96/terminate" method="put"/>' +
    '  <a name="postpone" href="https://api.recurly.com/v2/subscriptions/44f83d7cba354d5b84812419f923ea96/postpone" method="put"/>' +
    '</subscription>',
  'accounts/104':
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<account href="https://api.recurly.com/v2/accounts/104">' +
    '  <adjustments href="https://api.recurly.com/v2/accounts/1/adjustments"/>' +
    '  <billing_info href="https://api.recurly.com/v2/accounts/1/billing_info"/>' +
    '  <invoices href="https://api.recurly.com/v2/accounts/1/invoices"/>' +
    '  <redemption href="https://api.recurly.com/v2/accounts/1/redemption"/>' +
    '  <subscriptions href="https://api.recurly.com/v2/accounts/1/subscriptions"/>' +
    '  <transactions href="https://api.recurly.com/v2/accounts/1/transactions"/>' +
    '  <account_code>104</account_code>' +
    '  <state>active</state>' +
    '  <username nil="nil"></username>' +
    '  <email>verena@example.com</email>' +
    '  <first_name>Verena</first_name>' +
    '  <last_name>Example</last_name>' +
    '  <accept_language nil="nil"></accept_language>' +
    '  <hosted_login_token>a92468579e9c4231a6c0031c4716c01d</hosted_login_token>' +
    '  <created_at type="datetime">2011-10-25T12:00:00</created_at>' +
    '</account>',
}

vi.mock('../../../../app/src/Features/Subscription/Errors', () =>
  vi.importActual('../../../../app/src/Features/Subscription/Errors')
)

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

const mockApiRequest = function (options) {
  if (fixtures[options.url]) {
    return {
      err: null,
      response: { status: 200 },
      body: fixtures[options.url],
    }
  } else {
    return {
      err: new Error('Not found'),
    }
  }
}

describe('RecurlyWrapper', function () {
  beforeEach(async function (ctx) {
    tk.freeze(Date.now()) // freeze the time for these tests
    ctx.settings = {
      plans: [
        {
          planCode: 'collaborator',
          name: 'Collaborator',
          features: {
            collaborators: -1,
            versioning: true,
          },
        },
      ],
      defaultPlanCode: {
        collaborators: 0,
        versioning: false,
      },
      apis: {
        recurly: {
          apiKey: 'nonsense',
          privateKey: 'private_nonsense',
        },
      },
    }

    ctx.fetchUtils = {
      fetchStringWithResponse: sinon.stub(),
      RequestFailedError,
    }

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('@overleaf/fetch-utils', () => ({
      default: ctx.fetchUtils,
    }))

    ctx.RecurlyWrapper = (await import(modulePath)).default
  })

  afterEach(function () {
    tk.reset()
  })

  describe('getSubscription', function () {
    for (const functionType of ['promise', 'callback']) {
      describe(`as ${functionType}`, function () {
        beforeEach(function (ctx) {
          ctx.recurlySubscription = 'RESET'
          ctx.getSubscription = (...params) => {
            if (functionType === 'promise') {
              return ctx.RecurlyWrapper.promises.getSubscription(...params)
            }
            if (functionType === 'callback') {
              return new Promise((resolve, reject) =>
                ctx.RecurlyWrapper.getSubscription(
                  ...params,
                  (err, subscription) =>
                    err ? reject(err) : resolve(subscription)
                )
              )
            }
            throw Error('Invalid function type')
          }
        })

        describe('with proper subscription id', function () {
          beforeEach(async function (ctx) {
            ctx.apiRequest = sinon
              .stub(ctx.RecurlyWrapper.promises, 'apiRequest')
              .callsFake(mockApiRequest)
            ctx.recurlySubscription = await ctx.getSubscription(
              '44f83d7cba354d5b84812419f923ea96'
            )
          })
          afterEach(function (ctx) {
            ctx.RecurlyWrapper.promises.apiRequest.restore()
          })

          it('should look up the subscription at the normal API end point', function (ctx) {
            ctx.apiRequest.args[0][0].url.should.equal(
              'subscriptions/44f83d7cba354d5b84812419f923ea96'
            )
          })

          it('should return the subscription', function (ctx) {
            ctx.recurlySubscription.uuid.should.equal(
              '44f83d7cba354d5b84812419f923ea96'
            )
          })
        })

        describe('with RecurlyJS token', function () {
          beforeEach(async function (ctx) {
            ctx.apiRequest = sinon
              .stub(ctx.RecurlyWrapper.promises, 'apiRequest')
              .callsFake(mockApiRequest)
            ctx.recurlySubscription = await ctx.getSubscription(
              '70db44b10f5f4b238669480c9903f6f5',
              { recurlyJsResult: true }
            )
          })
          afterEach(function (ctx) {
            ctx.RecurlyWrapper.promises.apiRequest.restore()
          })

          it('should return the subscription', function (ctx) {
            ctx.recurlySubscription.uuid.should.equal(
              '44f83d7cba354d5b84812419f923ea96'
            )
          })

          it('should look up the subscription at the RecurlyJS API end point', function (ctx) {
            ctx.apiRequest.args[0][0].url.should.equal(
              'recurly_js/result/70db44b10f5f4b238669480c9903f6f5'
            )
          })
        })

        describe('with includeAccount', function () {
          beforeEach(async function (ctx) {
            ctx.apiRequest = sinon
              .stub(ctx.RecurlyWrapper.promises, 'apiRequest')
              .callsFake(mockApiRequest)
            ctx.recurlySubscription = await ctx.getSubscription(
              '44f83d7cba354d5b84812419f923ea96',
              { includeAccount: true }
            )
          })
          afterEach(function (ctx) {
            ctx.RecurlyWrapper.promises.apiRequest.restore()
          })

          it('should request the account from the API', function (ctx) {
            ctx.apiRequest.args[1][0].url.should.equal('accounts/104')
          })

          it('should populate the account attribute', function (ctx) {
            ctx.recurlySubscription.account.account_code.should.equal('104')
          })
        })
      })
    }
  })

  describe('updateAccountEmailAddress', function () {
    beforeEach(async function (ctx) {
      ctx.recurlyAccountId = 'account-id-123'
      ctx.newEmail = 'example@overleaf.com'
      ctx.apiRequest = sinon
        .stub(ctx.RecurlyWrapper.promises, 'apiRequest')
        .callsFake(options => {
          ctx.requestOptions = options
          return {
            err: null,
            response: {},
            body: fixtures['accounts/104'],
          }
        })

      ctx.recurlyAccount =
        await ctx.RecurlyWrapper.promises.updateAccountEmailAddress(
          ctx.recurlyAccountId,
          ctx.newEmail
        )
    })

    afterEach(function (ctx) {
      ctx.RecurlyWrapper.promises.apiRequest.restore()
    })

    it('sends correct XML', function (ctx) {
      ctx.apiRequest.called.should.equal(true)
      const { body } = ctx.apiRequest.lastCall.args[0]
      expect(body).to.equal(`\
<account>
	<email>example@overleaf.com</email>
</account>\
`)
      ctx.requestOptions.url.should.equal(`accounts/${ctx.recurlyAccountId}`)
      ctx.requestOptions.method.should.equal('PUT')
    })

    it('should return the updated account', function (ctx) {
      expect(ctx.recurlyAccount).to.exist
      ctx.recurlyAccount.account_code.should.equal('104')
    })
  })

  describe('updateAccountEmailAddress, with invalid XML', function () {
    beforeEach(async function (ctx) {
      ctx.recurlyAccountId = 'account-id-123'
      ctx.newEmail = '\uD800@example.com'
      ctx.apiRequest = sinon
        .stub(ctx.RecurlyWrapper.promises, 'apiRequest')
        .callsFake(options => {
          ctx.requestOptions = options
          return {
            err: null,
            response: {},
            body: fixtures['accounts/104'],
          }
        })
    })

    afterEach(function (ctx) {
      ctx.RecurlyWrapper.promises.apiRequest.restore()
    })

    it('should produce an error', async function (ctx) {
      try {
        await ctx.RecurlyWrapper.promises.updateAccountEmailAddress(
          ctx.recurlyAccountId,
          ctx.newEmail
        )
        assert.fail('Expected error not thrown')
      } catch (error) {
        expect(error).to.have.property('message')
        expect(error.message.startsWith('Invalid character')).to.be.true
        expect(ctx.apiRequest.called).to.equal(false)
      }
    })
  })

  describe('updateSubscription', function () {
    beforeEach(async function (ctx) {
      ctx.recurlySubscriptionId = 'subscription-id-123'
      ctx.apiRequest = sinon
        .stub(ctx.RecurlyWrapper.promises, 'apiRequest')
        .callsFake(options => {
          ctx.requestOptions = options
          return {
            error: null,
            response: {},
            body: fixtures['subscriptions/44f83d7cba354d5b84812419f923ea96'],
          }
        })
      ctx.recurlySubscription =
        await ctx.RecurlyWrapper.promises.updateSubscription(
          ctx.recurlySubscriptionId,
          { plan_code: 'silver', timeframe: 'now' }
        )
    })
    afterEach(function (ctx) {
      ctx.RecurlyWrapper.promises.apiRequest.restore()
    })

    it('sends correct XML', function (ctx) {
      ctx.apiRequest.called.should.equal(true)
      const { body } = ctx.apiRequest.lastCall.args[0]
      expect(body).to.equal(`\
<subscription>
	<plan_code>silver</plan_code>
	<timeframe>now</timeframe>
</subscription>\
`)
      ctx.requestOptions.url.should.equal(
        `subscriptions/${ctx.recurlySubscriptionId}`
      )
      ctx.requestOptions.method.should.equal('PUT')
    })

    it('should return the updated subscription', function (ctx) {
      expect(ctx.recurlySubscription).to.exist
      ctx.recurlySubscription.plan.plan_code.should.equal('gold')
    })
  })

  describe('redeemCoupon', function () {
    beforeEach(async function (ctx) {
      ctx.recurlyAccountId = 'account-id-123'
      ctx.coupon_code = '312321312'
      ctx.apiRequest = sinon
        .stub(ctx.RecurlyWrapper.promises, 'apiRequest')
        .callsFake(options => {
          options.url.should.equal(`coupons/${ctx.coupon_code}/redeem`)
          options.method.should.equal('POST')
          return {}
        })
      await ctx.RecurlyWrapper.promises.redeemCoupon(
        ctx.recurlyAccountId,
        ctx.coupon_code
      )
    })

    afterEach(function (ctx) {
      ctx.RecurlyWrapper.promises.apiRequest.restore()
    })

    it('sends correct XML', function (ctx) {
      ctx.apiRequest.called.should.equal(true)
      const { body } = ctx.apiRequest.lastCall.args[0]
      expect(body).to.equal(`\
<redemption>
	<account_code>account-id-123</account_code>
	<currency>USD</currency>
</redemption>\
`)
    })
  })

  describe('createFixedAmountCoupon', function () {
    beforeEach(async function (ctx) {
      ctx.couponCode = 'a-coupon-code'
      ctx.couponName = 'a-coupon-name'
      ctx.currencyCode = 'EUR'
      ctx.discount = 1337
      ctx.planCode = 'a-plan-code'
      ctx.apiRequest = sinon
        .stub(ctx.RecurlyWrapper.promises, 'apiRequest')
        .resolves()
      await ctx.RecurlyWrapper.promises.createFixedAmountCoupon(
        ctx.couponCode,
        ctx.couponName,
        ctx.currencyCode,
        ctx.discount,
        ctx.planCode
      )
    })

    afterEach(function (ctx) {
      ctx.RecurlyWrapper.promises.apiRequest.restore()
    })

    it('sends correct XML', function (ctx) {
      ctx.apiRequest.called.should.equal(true)
      const { body } = ctx.apiRequest.lastCall.args[0]
      expect(body).to.equal(`\
<coupon>
	<coupon_code>a-coupon-code</coupon_code>
	<name>a-coupon-name</name>
	<discount_type>dollars</discount_type>
	<discount_in_cents>
		<EUR>1337</EUR>
	</discount_in_cents>
	<plan_codes>
		<plan_code>a-plan-code</plan_code>
	</plan_codes>
	<applies_to_all_plans>false</applies_to_all_plans>
</coupon>\
`)
    })
  })

  describe('createSubscription', function () {
    beforeEach(function (ctx) {
      ctx.user = {
        _id: 'some_id',
        email: 'user@example.com',
      }
      ctx.subscriptionDetails = {
        currencyCode: 'EUR',
        plan_code: 'some_plan_code',
        coupon_code: '',
        isPaypal: true,
        address: {
          address1: 'addr_one',
          address2: 'addr_two',
          country: 'some_country',
          state: 'some_state',
          zip: 'some_zip',
        },
      }
      ctx.subscription = {}
      ctx.recurlyTokenIds = {
        billing: 'a-token-id',
        threeDSecureActionResult: 'a-3d-token-id',
      }
      ctx.call = () => {
        return ctx.RecurlyWrapper.promises.createSubscription(
          ctx.user,
          ctx.subscriptionDetails,
          ctx.recurlyTokenIds
        )
      }
    })

    describe('when paypal', function () {
      beforeEach(function (ctx) {
        ctx.subscriptionDetails.isPaypal = true
        ctx._createPaypalSubscription = sinon.stub(
          ctx.RecurlyWrapper.promises,
          '_createPaypalSubscription'
        )
        ctx._createPaypalSubscription.resolves(ctx.subscription)
      })

      afterEach(function (ctx) {
        ctx._createPaypalSubscription.restore()
      })

      it('should not produce an error', async function (ctx) {
        await expect(ctx.call()).to.be.fulfilled
      })

      it('should produce a subscription object', async function (ctx) {
        const sub = await ctx.call()
        expect(sub).to.deep.equal(ctx.subscription)
      })

      it('should call _createPaypalSubscription', async function (ctx) {
        await ctx.call()
        ctx._createPaypalSubscription.callCount.should.equal(1)
      })

      describe('when _createPaypalSubscription produces an error', function () {
        beforeEach(function (ctx) {
          ctx._createPaypalSubscription.rejects(new Error('woops'))
        })

        it('should produce an error', async function (ctx) {
          await expect(ctx.call()).to.be.rejectedWith('woops')
        })
      })
    })

    describe('when not paypal', function () {
      beforeEach(function (ctx) {
        ctx.subscriptionDetails.isPaypal = false
        ctx._createCreditCardSubscription = sinon.stub(
          ctx.RecurlyWrapper.promises,
          '_createCreditCardSubscription'
        )
        ctx._createCreditCardSubscription.resolves(ctx.subscription)
      })

      afterEach(function (ctx) {
        ctx._createCreditCardSubscription.restore()
      })

      it('should not produce an error', async function (ctx) {
        await ctx.call()
      })

      it('should produce a subscription object', async function (ctx) {
        const sub = await ctx.call()
        expect(sub).to.deep.equal(ctx.subscription)
      })

      it('should call _createCreditCardSubscription', async function (ctx) {
        await ctx.call()
        ctx._createCreditCardSubscription.callCount.should.equal(1)
      })

      describe('when _createCreditCardSubscription produces an error', function () {
        beforeEach(function (ctx) {
          ctx._createCreditCardSubscription.rejects(new Error('woops'))
        })

        it('should produce an error', async function (ctx) {
          await expect(ctx.call()).to.be.rejectedWith('woops')
        })
      })
    })
  })

  describe('_createCreditCardSubscription', function () {
    beforeEach(function (ctx) {
      ctx.user = {
        _id: 'some_id',
        email: 'user@example.com',
        first_name: 'Foo',
        last_name: 'Johnson',
      }
      ctx.subscriptionDetails = {
        currencyCode: 'EUR',
        plan_code: 'some_plan_code',
        coupon_code: '',
        isPaypal: true,
        first_name: 'Prairie',
        address: {
          address1: 'addr_one',
          address2: 'addr_two',
          country: 'some_country',
          state: 'some_state',
          zip: 'some_zip',
        },
        subscription_add_ons: [
          { subscription_add_on: { add_on_code: 'test_add_on', quantity: 2 } },
        ],
        ITMCampaign: 'itm-campaign-value',
        ITMContent: 'itm-content-value',
        ITMReferrer: 'itm-referrer-value',
      }
      ctx.subscription = {}
      ctx.recurlyTokenIds = {
        billing: 'a-token-id',
        threeDSecureActionResult: 'a-3d-token-id',
      }
      ctx.apiRequest = sinon.stub(ctx.RecurlyWrapper.promises, 'apiRequest')
      ctx.response = { status: 200 }
      ctx.body = '<xml>is_bad</xml>'
      ctx.apiRequest.resolves({
        response: ctx.response,
        body: ctx.body,
      })
      ctx._parseSubscriptionXml = sinon.stub(
        ctx.RecurlyWrapper.promises,
        '_parseSubscriptionXml'
      )
      ctx._parseSubscriptionXml.resolves(ctx.subscription)
      ctx.call = () => {
        return ctx.RecurlyWrapper.promises._createCreditCardSubscription(
          ctx.user,
          ctx.subscriptionDetails,
          ctx.recurlyTokenIds
        )
      }
    })

    afterEach(function (ctx) {
      ctx.apiRequest.restore()
      ctx._parseSubscriptionXml.restore()
    })

    it('sends correct XML', async function (ctx) {
      await ctx.call()

      const { body } = ctx.apiRequest.lastCall.args[0]
      expect(body).to.equal(`\
<subscription>
	<plan_code>some_plan_code</plan_code>
	<currency>EUR</currency>
	<coupon_code/>
	<account>
		<account_code>some_id</account_code>
		<email>user@example.com</email>
		<first_name>Prairie</first_name>
		<last_name>Johnson</last_name>
		<billing_info>
			<token_id>a-token-id</token_id>
			<three_d_secure_action_result_token_id>a-3d-token-id</three_d_secure_action_result_token_id>
		</billing_info>
	</account>
	<subscription_add_ons>
		<subscription_add_on>
			<add_on_code>test_add_on</add_on_code>
			<quantity>2</quantity>
		</subscription_add_on>
	</subscription_add_ons>
	<custom_fields>
		<custom_field>
			<name>itm_campaign</name>
			<value>itm-campaign-value</value>
		</custom_field>
		<custom_field>
			<name>itm_content</name>
			<value>itm-content-value</value>
		</custom_field>
		<custom_field>
			<name>itm_referrer</name>
			<value>itm-referrer-value</value>
		</custom_field>
	</custom_fields>
</subscription>\
`)
    })

    it('should not produce an error', async function (ctx) {
      await expect(ctx.call()).to.be.fulfilled
    })

    it('should produce a subscription', async function (ctx) {
      const sub = await ctx.call()
      expect(sub).to.equal(ctx.subscription)
    })

    it('should call apiRequest', async function (ctx) {
      await ctx.call()
      ctx.apiRequest.callCount.should.equal(1)
    })

    it('should call _parseSubscriptionXml', async function (ctx) {
      await ctx.call()
      ctx._parseSubscriptionXml.callCount.should.equal(1)
    })

    describe('when api request returns 422', function () {
      beforeEach(function (ctx) {
        const body = `\
          <?xml version="1.0" encoding="UTF-8"?>
          <errors>
            <transaction_error>
              <error_code>three_d_secure_action_required</error_code>
              <error_category>3d_secure_action_required</error_category>
              <merchant_message>Your payment gateway is requesting that the transaction be completed with 3D Secure in accordance with PSD2.</merchant_message>
              <customer_message>Your card must be authenticated with 3D Secure before continuing.</customer_message>
              <gateway_error_code nil="nil"></gateway_error_code>
              <three_d_secure_action_token_id>mock_three_d_secure_action_token</three_d_secure_action_token_id>
            </transaction_error>
            <error field="subscription.account.base" symbol="three_d_secure_action_required">Your card must be authenticated with 3D Secure before continuing.</error>
          </errors>
        `
        // this.apiRequest.yields(null, { statusCode: 422 }, body)
        ctx.apiRequest.resolves({
          response: { status: 422 },
          body,
        })
      })

      it('should produce an error', async function (ctx) {
        const promise = ctx.call()
        let error

        try {
          await promise
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(
          SubscriptionErrors.RecurlyTransactionError
        )
        expect(error).to.have.nested.property(
          'info.public.message',
          'Your card must be authenticated with 3D Secure before continuing.'
        )
        expect(error).to.have.nested.property(
          'info.public.threeDSecureActionTokenId',
          'mock_three_d_secure_action_token'
        )
      })
    })

    describe('when api request produces an error', function () {
      beforeEach(function (ctx) {
        ctx.apiRequest.rejects(new Error('woops'))
      })

      it('should produce an error', async function (ctx) {
        await expect(ctx.call()).to.be.rejectedWith('woops')
      })

      it('should call apiRequest', async function (ctx) {
        await expect(ctx.call()).to.be.rejected
        ctx.apiRequest.callCount.should.equal(1)
      })

      it('should not _parseSubscriptionXml', async function (ctx) {
        await expect(ctx.call()).to.be.rejected
        ctx._parseSubscriptionXml.callCount.should.equal(0)
      })
    })

    describe('when parse xml produces an error', function () {
      beforeEach(function (ctx) {
        ctx._parseSubscriptionXml.rejects(new Error('woops xml'))
      })

      it('should produce an error', async function (ctx) {
        await expect(ctx.call()).to.be.rejectedWith('woops xml')
      })
    })
  })

  describe('_createPaypalSubscription', function () {
    beforeEach(function (ctx) {
      ctx.checkAccountExists = sinon.stub(
        ctx.RecurlyWrapper.promises._paypal,
        'checkAccountExists'
      )
      ctx.createAccount = sinon.stub(
        ctx.RecurlyWrapper.promises._paypal,
        'createAccount'
      )
      ctx.createBillingInfo = sinon.stub(
        ctx.RecurlyWrapper.promises._paypal,
        'createBillingInfo'
      )
      ctx.setAddressAndCompanyBillingInfo = sinon.stub(
        ctx.RecurlyWrapper.promises._paypal,
        'setAddressAndCompanyBillingInfo'
      )
      ctx.createSubscription = sinon.stub(
        ctx.RecurlyWrapper.promises._paypal,
        'createSubscription'
      )
      ctx.user = {
        _id: 'some_id',
        email: 'user@example.com',
      }
      ctx.subscriptionDetails = {
        currencyCode: 'EUR',
        plan_code: 'some_plan_code',
        coupon_code: '',
        isPaypal: true,
        address: {
          address1: 'addr_one',
          address2: 'addr_two',
          country: 'some_country',
          state: 'some_state',
          zip: 'some_zip',
        },
      }
      ctx.subscription = {}
      ctx.recurlyTokenIds = {
        billing: 'a-token-id',
        threeDSecureActionResult: 'a-3d-token-id',
      }

      // set up data callbacks
      const { user } = ctx
      const { subscriptionDetails } = ctx
      const { recurlyTokenIds } = ctx

      ctx.checkAccountExists.resolves({
        user,
        subscriptionDetails,
        recurlyTokenIds,
        userExists: false,
        account: { accountCode: 'xx' },
      })
      ctx.createAccount.resolves({
        user,
        subscriptionDetails,
        recurlyTokenIds,
        userExists: false,
        account: { accountCode: 'xx' },
      })
      ctx.createBillingInfo.resolves({
        user,
        subscriptionDetails,
        recurlyTokenIds,
        userExists: false,
        account: { accountCode: 'xx' },
        billingInfo: { token_id: 'abc' },
      })
      ctx.setAddressAndCompanyBillingInfo.resolves({
        user,
        subscriptionDetails,
        recurlyTokenIds,
        userExists: false,
        account: { accountCode: 'xx' },
        billingInfo: { token_id: 'abc' },
      })
      ctx.createSubscription.resolves({
        user,
        subscriptionDetails,
        recurlyTokenIds,
        userExists: false,
        account: { accountCode: 'xx' },
        billingInfo: { token_id: 'abc' },
        subscription: ctx.subscription,
      })

      ctx.call = () => {
        return ctx.RecurlyWrapper.promises._createPaypalSubscription(
          ctx.user,
          ctx.subscriptionDetails,
          ctx.recurlyTokenIds
        )
      }
    })

    afterEach(function (ctx) {
      ctx.checkAccountExists.restore()
      ctx.createAccount.restore()
      ctx.createBillingInfo.restore()
      ctx.setAddressAndCompanyBillingInfo.restore()
      ctx.createSubscription.restore()
    })

    it('should not produce an error', async function (ctx) {
      await expect(ctx.call()).to.be.fulfilled
    })

    it('should produce a subscription object', async function (ctx) {
      const sub = await ctx.call()
      expect(sub).to.not.equal(null)
      expect(sub).to.equal(ctx.subscription)
    })

    it('should call each of the paypal stages', async function (ctx) {
      await ctx.call()
      ctx.checkAccountExists.callCount.should.equal(1)
      ctx.createAccount.callCount.should.equal(1)
      ctx.createBillingInfo.callCount.should.equal(1)
      ctx.setAddressAndCompanyBillingInfo.callCount.should.equal(1)
      ctx.createSubscription.callCount.should.equal(1)
    })

    describe('when one of the paypal stages produces an error', function () {
      beforeEach(function (ctx) {
        ctx.createAccount.rejects(new Error('woops'))
      })

      it('should produce an error', async function (ctx) {
        await expect(ctx.call()).to.be.rejectedWith('woops')
      })

      it('should stop calling the paypal stages after the error', async function (ctx) {
        await expect(ctx.call()).to.be.rejected
        ctx.checkAccountExists.callCount.should.equal(1)
        ctx.createAccount.callCount.should.equal(1)
        ctx.createBillingInfo.callCount.should.equal(0)
        ctx.setAddressAndCompanyBillingInfo.callCount.should.equal(0)
        ctx.createSubscription.callCount.should.equal(0)
      })
    })
  })

  describe('paypal actions', function () {
    beforeEach(function (ctx) {
      ctx.apiRequest = sinon.stub(ctx.RecurlyWrapper.promises, 'apiRequest')
      ctx._parseAccountXml = sinon.spy(
        ctx.RecurlyWrapper.promises,
        '_parseAccountXml'
      )
      ctx._parseBillingInfoXml = sinon.spy(
        ctx.RecurlyWrapper.promises,
        '_parseBillingInfoXml'
      )
      ctx._parseSubscriptionXml = sinon.spy(
        ctx.RecurlyWrapper.promises,
        '_parseSubscriptionXml'
      )
      ctx.cache = {
        user: (ctx.user = {
          _id: 'some_id',
          email: 'foo@bar.com',
          first_name: 'Foo',
          last_name: 'Bar',
        }),
        recurlyTokenIds: (ctx.recurlyTokenIds = {
          billing: 'a-token-id',
          threeDSecureActionResult: 'a-3d-token-id',
        }),
        subscriptionDetails: (ctx.subscriptionDetails = {
          currencyCode: 'EUR',
          plan_code: 'some_plan_code',
          coupon_code: '',
          isPaypal: true,
          address: {
            address1: 'addr_one',
            address2: 'addr_two',
            city: 'some_city',
            country: 'some_country',
            state: 'some_state',
            zip: 'some_zip',
          },
          ITMCampaign: 'itm-campaign-value',
          ITMContent: 'itm-content-value',
        }),
      }
    })

    afterEach(function (ctx) {
      ctx.apiRequest.restore()
      ctx._parseAccountXml.restore()
      ctx._parseBillingInfoXml.restore()
      ctx._parseSubscriptionXml.restore()
    })

    describe('_paypal.checkAccountExists', function () {
      beforeEach(function (ctx) {
        ctx.call = () => {
          return ctx.RecurlyWrapper.promises._paypal.checkAccountExists(
            ctx.cache
          )
        }
      })

      describe('when the account exists', function () {
        beforeEach(function (ctx) {
          const resultXml =
            '<account><account_code>abc</account_code></account>'
          ctx.apiRequest.resolves({
            response: { status: 200 },
            body: resultXml,
          })
        })

        it('should not produce an error', async function (ctx) {
          await expect(ctx.call()).to.be.fulfilled
        })

        it('should call apiRequest', async function (ctx) {
          await ctx.call()
          ctx.apiRequest.callCount.should.equal(1)
        })

        it('should call _parseAccountXml', async function (ctx) {
          await ctx.call()
          ctx.RecurlyWrapper.promises._parseAccountXml.callCount.should.equal(1)
        })

        it('should add the account to the cumulative result', async function (ctx) {
          const result = await ctx.call()
          expect(result.account).to.not.equal(null)
          expect(result.account).to.not.equal(undefined)
          expect(result.account).to.deep.equal({
            account_code: 'abc',
          })
        })

        it('should set userExists to true', async function (ctx) {
          const result = await ctx.call()
          expect(result.userExists).to.equal(true)
        })
      })

      describe('when the account does not exist', function () {
        beforeEach(function (ctx) {
          ctx.apiRequest.resolves({
            response: { status: 404 },
            body: '',
          })
        })

        it('should not produce an error', async function (ctx) {
          await expect(ctx.call()).to.be.fulfilled
        })

        it('should call apiRequest', async function (ctx) {
          await ctx.call()
          ctx.apiRequest.callCount.should.equal(1)
          ctx.apiRequest.firstCall.args[0].method.should.equal('GET')
        })

        it('should not call _parseAccountXml', async function (ctx) {
          await ctx.call()
          ctx.RecurlyWrapper.promises._parseAccountXml.callCount.should.equal(0)
        })

        it('should not add the account to result', async function (ctx) {
          const result = await ctx.call()
          expect(result.account).to.equal(undefined)
        })

        it('should set userExists to false', async function (ctx) {
          const result = await ctx.call()
          expect(result.userExists).to.equal(false)
        })
      })

      describe('when apiRequest produces an error', function () {
        beforeEach(function (ctx) {
          ctx.apiRequest.rejects(new Error('woops'))
        })

        it('should produce an error', async function (ctx) {
          await expect(ctx.call()).to.be.rejected
        })
      })
    })

    describe('_paypal.createAccount', function () {
      beforeEach(function (ctx) {
        ctx.call = () => {
          return ctx.RecurlyWrapper.promises._paypal.createAccount(ctx.cache)
        }
      })

      describe('when address is missing from subscriptionDetails', function () {
        beforeEach(function (ctx) {
          ctx.cache.subscriptionDetails.address = null
        })

        it('should produce an error', async function (ctx) {
          await expect(ctx.call()).to.be.rejected
        })
      })

      describe('when country is missing from address', function () {
        beforeEach(function (ctx) {
          ctx.cache.subscriptionDetails.address = {}
        })

        it('should produce an error', async function (ctx) {
          await expect(ctx.call()).to.be.rejectedWith(Errors.InvalidError)
        })
      })

      describe('when account already exists', function () {
        beforeEach(function (ctx) {
          ctx.cache.userExists = true
          ctx.cache.account = { account_code: 'abc' }
        })

        it('should not produce an error', async function (ctx) {
          await expect(ctx.call()).to.be.fulfilled
        })

        it('should produce cache object', async function (ctx) {
          const result = await ctx.call()
          expect(result).to.deep.equal(ctx.cache)
          expect(result.account).to.deep.equal({
            account_code: 'abc',
          })
        })

        it('should not call apiRequest', async function (ctx) {
          await expect(ctx.call()).to.be.fulfilled
          ctx.apiRequest.callCount.should.equal(0)
        })

        it('should not call _parseAccountXml', async function (ctx) {
          await ctx.call()
          ctx.RecurlyWrapper.promises._parseAccountXml.callCount.should.equal(0)
        })
      })

      describe('when account does not exist', function () {
        beforeEach(function (ctx) {
          ctx.cache.userExists = false
          const resultXml =
            '<account><account_code>abc</account_code></account>'
          ctx.apiRequest.resolves({
            response: { status: 200 },
            body: resultXml,
          })
        })

        it('sends correct XML', async function (ctx) {
          await ctx.call()
          const { body } = ctx.apiRequest.lastCall.args[0]
          expect(body).to.equal(`\
<account>
	<account_code>some_id</account_code>
	<email>foo@bar.com</email>
	<first_name>Foo</first_name>
	<last_name>Bar</last_name>
	<address>
		<address1>addr_one</address1>
		<address2>addr_two</address2>
		<city>some_city</city>
		<state>some_state</state>
		<zip>some_zip</zip>
		<country>some_country</country>
	</address>
</account>\
`)
        })

        it('should not produce an error', async function (ctx) {
          await expect(ctx.call()).to.be.fulfilled
        })

        it('should call apiRequest', async function (ctx) {
          await ctx.call()
          ctx.apiRequest.callCount.should.equal(1)
          ctx.apiRequest.firstCall.args[0].method.should.equal('POST')
        })

        it('should call _parseAccountXml', async function (ctx) {
          await ctx.call()
          ctx.RecurlyWrapper.promises._parseAccountXml.callCount.should.equal(1)
        })

        describe('when apiRequest produces an error', function () {
          beforeEach(function (ctx) {
            ctx.apiRequest.rejects(new Error('woops'))
          })

          it('should produce an error', async function (ctx) {
            await expect(ctx.call()).to.be.rejectedWith('woops')
          })
        })
      })
    })

    describe('_paypal.createBillingInfo', function () {
      beforeEach(function (ctx) {
        ctx.cache.account = { account_code: 'abc' }
        ctx.call = () => {
          return ctx.RecurlyWrapper.promises._paypal.createBillingInfo(
            ctx.cache
          )
        }
      })

      describe('when account_code is missing from cache', function () {
        beforeEach(function (ctx) {
          ctx.cache.account.account_code = null
        })

        it('should produce an error', async function (ctx) {
          await expect(ctx.call()).to.be.rejected
        })
      })

      describe('when all goes well', function () {
        beforeEach(function (ctx) {
          const resultXml = '<billing_info><a>1</a></billing_info>'
          ctx.apiRequest.resolves({
            response: { status: 200 },
            body: resultXml,
          })
        })

        it('sends correct XML', async function (ctx) {
          await ctx.call()
          const { body } = ctx.apiRequest.lastCall.args[0]
          expect(body).to.equal(`\
<billing_info>
	<token_id>a-token-id</token_id>
</billing_info>\
`)
        })

        it('should not produce an error', async function (ctx) {
          await expect(ctx.call()).to.be.fulfilled
        })

        it('should call apiRequest', async function (ctx) {
          await ctx.call()
          ctx.apiRequest.callCount.should.equal(1)
          ctx.apiRequest.firstCall.args[0].method.should.equal('POST')
        })

        it('should call _parseBillingInfoXml', async function (ctx) {
          await ctx.call()
          ctx.RecurlyWrapper.promises._parseBillingInfoXml.callCount.should.equal(
            1
          )
        })

        it('should set billingInfo on cache', async function (ctx) {
          const result = await ctx.call()
          expect(result.billingInfo).to.deep.equal({
            a: '1',
          })
        })
      })

      describe('when apiRequest produces an error', function () {
        beforeEach(function (ctx) {
          ctx.apiRequest.resolves(new Error('woops'))
        })

        it('should produce an error', async function (ctx) {
          await expect(ctx.call()).to.be.rejected
        })
      })
    })

    describe('_paypal.setAddressAndCompanyBillingInfo', function () {
      beforeEach(function (ctx) {
        ctx.cache.account = { account_code: 'abc' }
        ctx.cache.billingInfo = {}
        ctx.call = () => {
          return ctx.RecurlyWrapper.promises._paypal.setAddressAndCompanyBillingInfo(
            ctx.cache
          )
        }
      })

      describe('when account_code is missing from cache', function () {
        beforeEach(function (ctx) {
          ctx.cache.account.account_code = null
        })

        it('should produce an error', async function (ctx) {
          await expect(ctx.call()).to.be.rejected
        })
      })

      describe('when country is missing', function () {
        beforeEach(function (ctx) {
          ctx.cache.subscriptionDetails.address = { country: '' }
        })

        it('should produce an error', async function (ctx) {
          await expect(ctx.call()).to.be.rejectedWith(Errors.InvalidError)
        })
      })

      describe('when all goes well', function () {
        beforeEach(function (ctx) {
          const resultXml = '<billing_info><city>London</city></billing_info>'
          ctx.apiRequest.resolves({
            response: { status: 200 },
            body: resultXml,
          })
        })

        it('sends correct XML', async function (ctx) {
          await ctx.call()
          const { body } = ctx.apiRequest.lastCall.args[0]
          expect(body).to.equal(`\
<billing_info>
	<address1>addr_one</address1>
	<address2>addr_two</address2>
	<city>some_city</city>
	<state>some_state</state>
	<zip>some_zip</zip>
	<country>some_country</country>
</billing_info>\
`)
        })

        it('should not produce an error', async function (ctx) {
          await expect(ctx.call()).to.be.fulfilled
        })

        it('should call apiRequest', async function (ctx) {
          await ctx.call()
          ctx.apiRequest.callCount.should.equal(1)
          ctx.apiRequest.firstCall.args[0].method.should.equal('PUT')
        })

        it('should call _parseBillingInfoXml', async function (ctx) {
          await ctx.call()
          ctx.RecurlyWrapper.promises._parseBillingInfoXml.callCount.should.equal(
            1
          )
        })

        it('should set billingInfo on cache', async function (ctx) {
          const result = await ctx.call()
          expect(result.billingInfo).to.deep.equal({
            city: 'London',
          })
        })
      })

      describe('when apiRequest produces an error', function () {
        beforeEach(function (ctx) {
          ctx.apiRequest.rejects(new Error('woops'))
        })

        it('should produce an error', async function (ctx) {
          await expect(ctx.call()).to.be.rejected
        })
      })
    })

    describe('_paypal.createSubscription', function () {
      beforeEach(function (ctx) {
        ctx.cache.account = { account_code: 'abc' }
        ctx.cache.billingInfo = {}
        ctx.call = () =>
          ctx.RecurlyWrapper.promises._paypal.createSubscription(ctx.cache)
      })

      describe('when all goes well', function () {
        beforeEach(function (ctx) {
          const resultXml = '<subscription><a>1</a></subscription>'
          ctx.apiRequest.resolves({
            response: { status: 200 },
            body: resultXml,
          })
        })

        it('sends correct XML', async function (ctx) {
          await ctx.call()
          const { body } = ctx.apiRequest.lastCall.args[0]
          expect(body).to.equal(`\
<subscription>
	<plan_code>some_plan_code</plan_code>
	<currency>EUR</currency>
	<coupon_code/>
	<account>
		<account_code>some_id</account_code>
	</account>
	<custom_fields>
		<custom_field>
			<name>itm_campaign</name>
			<value>itm-campaign-value</value>
		</custom_field>
		<custom_field>
			<name>itm_content</name>
			<value>itm-content-value</value>
		</custom_field>
	</custom_fields>
</subscription>\
`)
        })

        it('should not produce an error', async function (ctx) {
          await expect(ctx.call()).to.be.fulfilled
        })

        it('should call apiRequest', async function (ctx) {
          await ctx.call()
          ctx.apiRequest.callCount.should.equal(1)
          ctx.apiRequest.firstCall.args[0].method.should.equal('POST')
        })

        it('should call _parseSubscriptionXml', async function (ctx) {
          await ctx.call()
          ctx.RecurlyWrapper.promises._parseSubscriptionXml.callCount.should.equal(
            1
          )
        })

        it('should set subscription on cache', async function (ctx) {
          const result = await ctx.call()
          expect(result.subscription).to.deep.equal({
            a: '1',
          })
        })
      })

      describe('when apiRequest produces an error', function () {
        beforeEach(function (ctx) {
          ctx.apiRequest.rejects(new Error('woops'))
        })

        it('should produce an error', async function (ctx) {
          await expect(ctx.call()).to.be.rejected
        })
      })
    })
  })

  describe('listAccountActiveSubscriptions', function () {
    beforeEach(function (ctx) {
      ctx.user_id = 'mock-user-id'
      ctx.response = { mock: 'response' }
      ctx.body = '<mock body/>'
      ctx.RecurlyWrapper.promises.apiRequest = sinon.stub().resolves({
        response: ctx.response,
        body: ctx.body,
      })
      ctx.subscriptions = ['mock', 'subscriptions']
      ctx.RecurlyWrapper.promises._parseSubscriptionsXml = sinon
        .stub()
        .resolves(ctx.subscriptions)
    })

    describe('with an account', function () {
      beforeEach(async function (ctx) {
        ctx.result =
          await ctx.RecurlyWrapper.promises.listAccountActiveSubscriptions(
            ctx.user_id
          )
      })

      it('should send a request to Recurly', async function (ctx) {
        ctx.RecurlyWrapper.promises.apiRequest
          .calledWith({
            url: `accounts/${ctx.user_id}/subscriptions`,
            qs: {
              state: 'active',
            },
            expect404: true,
          })
          .should.equal(true)
      })

      it('should return the subscriptions', async function (ctx) {
        expect(ctx.result).to.deep.equal(ctx.subscriptions)
      })
    })

    describe('without an account', function () {
      beforeEach(async function (ctx) {
        ctx.response.status = 404
        ctx.accountActiveSubscriptions =
          await ctx.RecurlyWrapper.promises.listAccountActiveSubscriptions(
            ctx.user_id
          )
      })

      it('should return an empty array of subscriptions', function (ctx) {
        expect(ctx.accountActiveSubscriptions).to.deep.equal([])
      })
    })
  })

  describe('extendTrial', function () {
    beforeEach(function (ctx) {
      ctx.subscriptionId = 'subscription-id-123'
    })

    afterEach(function (ctx) {
      ctx.RecurlyWrapper.promises.apiRequest.restore()
      tk.reset()
    })

    describe('with default parameters (7 days)', function () {
      beforeEach(async function (ctx) {
        tk.freeze(new Date('2025-01-25T10:30:00Z'))

        ctx.apiRequest = sinon
          .stub(ctx.RecurlyWrapper.promises, 'apiRequest')
          .resolves()
        await ctx.RecurlyWrapper.promises.extendTrial(ctx.subscriptionId)
      })

      it('should extend trial by 7 days from current time', function (ctx) {
        const options = ctx.apiRequest.lastCall.args[0]
        expect(options.qs.next_bill_date).to.deep.equal(
          new Date('2025-02-01T10:30:00Z')
        )
      })
    })

    describe('extending trial across year boundary', function () {
      beforeEach(async function (ctx) {
        // Trial ends on December 28, 2025, extend by 14 days to cross into 2026
        ctx.trialEndsAt = new Date('2025-12-28T12:00:00Z')
        ctx.daysUntilExpire = 14

        ctx.apiRequest = sinon
          .stub(ctx.RecurlyWrapper.promises, 'apiRequest')
          .resolves()
        await ctx.RecurlyWrapper.promises.extendTrial(
          ctx.subscriptionId,
          ctx.trialEndsAt,
          ctx.daysUntilExpire
        )
      })

      it('should correctly calculate date across year boundary', function (ctx) {
        const options = ctx.apiRequest.lastCall.args[0]
        expect(options.qs.next_bill_date).to.deep.equal(
          new Date('2026-01-11T12:00:00Z')
        )
      })
    })
  })
})
