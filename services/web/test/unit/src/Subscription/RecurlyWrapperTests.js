const { expect } = require('chai')
const sinon = require('sinon')
const modulePath = '../../../../app/src/Features/Subscription/RecurlyWrapper'
const SandboxedModule = require('sandboxed-module')
const tk = require('timekeeper')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const SubscriptionErrors = require('../../../../app/src/Features/Subscription/Errors')
const { RequestFailedError } = require('@overleaf/fetch-utils')

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
  beforeEach(function () {
    this.settings = {
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

    this.fetchUtils = {
      fetchStringWithResponse: sinon.stub(),
      RequestFailedError,
    }
    tk.freeze(Date.now()) // freeze the time for these tests
    this.RecurlyWrapper = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': this.settings,
        '@overleaf/fetch-utils': this.fetchUtils,
        './Errors': SubscriptionErrors,
      },
    })
  })

  afterEach(function () {
    tk.reset()
  })

  describe('getSubscription', function () {
    for (const functionType of ['promise', 'callback']) {
      describe(`as ${functionType}`, function () {
        beforeEach(function () {
          this.recurlySubscription = 'RESET'
          this.getSubscription = (...params) => {
            if (functionType === 'promise') {
              return this.RecurlyWrapper.promises.getSubscription(...params)
            }
            if (functionType === 'callback') {
              return new Promise((resolve, reject) =>
                this.RecurlyWrapper.getSubscription(
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
          beforeEach(async function () {
            this.apiRequest = sinon
              .stub(this.RecurlyWrapper.promises, 'apiRequest')
              .callsFake(mockApiRequest)
            this.recurlySubscription = await this.getSubscription(
              '44f83d7cba354d5b84812419f923ea96'
            )
          })
          afterEach(function () {
            this.RecurlyWrapper.promises.apiRequest.restore()
          })

          it('should look up the subscription at the normal API end point', function () {
            this.apiRequest.args[0][0].url.should.equal(
              'subscriptions/44f83d7cba354d5b84812419f923ea96'
            )
          })

          it('should return the subscription', function () {
            this.recurlySubscription.uuid.should.equal(
              '44f83d7cba354d5b84812419f923ea96'
            )
          })
        })

        describe('with RecurlyJS token', function () {
          beforeEach(async function () {
            this.apiRequest = sinon
              .stub(this.RecurlyWrapper.promises, 'apiRequest')
              .callsFake(mockApiRequest)
            this.recurlySubscription = await this.getSubscription(
              '70db44b10f5f4b238669480c9903f6f5',
              { recurlyJsResult: true }
            )
          })
          afterEach(function () {
            this.RecurlyWrapper.promises.apiRequest.restore()
          })

          it('should return the subscription', function () {
            this.recurlySubscription.uuid.should.equal(
              '44f83d7cba354d5b84812419f923ea96'
            )
          })

          it('should look up the subscription at the RecurlyJS API end point', function () {
            this.apiRequest.args[0][0].url.should.equal(
              'recurly_js/result/70db44b10f5f4b238669480c9903f6f5'
            )
          })
        })

        describe('with includeAccount', function () {
          beforeEach(async function () {
            this.apiRequest = sinon
              .stub(this.RecurlyWrapper.promises, 'apiRequest')
              .callsFake(mockApiRequest)
            this.recurlySubscription = await this.getSubscription(
              '44f83d7cba354d5b84812419f923ea96',
              { includeAccount: true }
            )
          })
          afterEach(function () {
            this.RecurlyWrapper.promises.apiRequest.restore()
          })

          it('should request the account from the API', function () {
            this.apiRequest.args[1][0].url.should.equal('accounts/104')
          })

          it('should populate the account attribute', function () {
            this.recurlySubscription.account.account_code.should.equal('104')
          })
        })
      })
    }
  })

  describe('updateAccountEmailAddress', function () {
    beforeEach(async function () {
      this.recurlyAccountId = 'account-id-123'
      this.newEmail = 'example@overleaf.com'
      this.apiRequest = sinon
        .stub(this.RecurlyWrapper.promises, 'apiRequest')
        .callsFake(options => {
          this.requestOptions = options
          return {
            err: null,
            response: {},
            body: fixtures['accounts/104'],
          }
        })

      this.recurlyAccount =
        await this.RecurlyWrapper.promises.updateAccountEmailAddress(
          this.recurlyAccountId,
          this.newEmail
        )
    })

    afterEach(function () {
      this.RecurlyWrapper.promises.apiRequest.restore()
    })

    it('sends correct XML', function () {
      this.apiRequest.called.should.equal(true)
      const { body } = this.apiRequest.lastCall.args[0]
      expect(body).to.equal(`\
<account>
	<email>example@overleaf.com</email>
</account>\
`)
      this.requestOptions.url.should.equal(`accounts/${this.recurlyAccountId}`)
      this.requestOptions.method.should.equal('PUT')
    })

    it('should return the updated account', function () {
      expect(this.recurlyAccount).to.exist
      this.recurlyAccount.account_code.should.equal('104')
    })
  })

  describe('updateAccountEmailAddress, with invalid XML', function () {
    beforeEach(async function (done) {
      this.recurlyAccountId = 'account-id-123'
      this.newEmail = '\uD800@example.com'
      this.apiRequest = sinon
        .stub(this.RecurlyWrapper.promises, 'apiRequest')
        .callsFake(options => {
          this.requestOptions = options
          return {
            err: null,
            response: {},
            body: fixtures['accounts/104'],
          }
        })
      done()
    })

    afterEach(function () {
      this.RecurlyWrapper.promises.apiRequest.restore()
    })

    it('should produce an error', function (done) {
      this.RecurlyWrapper.promises
        .updateAccountEmailAddress(this.recurlyAccountId, this.newEmail)
        .catch(error => {
          expect(error).to.exist
          expect(error.message.startsWith('Invalid character')).to.equal(true)
          expect(this.apiRequest.called).to.equal(false)
          done()
        })
    })
  })

  describe('updateSubscription', function () {
    beforeEach(async function () {
      this.recurlySubscriptionId = 'subscription-id-123'
      this.apiRequest = sinon
        .stub(this.RecurlyWrapper.promises, 'apiRequest')
        .callsFake(options => {
          this.requestOptions = options
          return {
            error: null,
            response: {},
            body: fixtures['subscriptions/44f83d7cba354d5b84812419f923ea96'],
          }
        })
      this.recurlySubscription =
        await this.RecurlyWrapper.promises.updateSubscription(
          this.recurlySubscriptionId,
          { plan_code: 'silver', timeframe: 'now' }
        )
    })
    afterEach(function () {
      this.RecurlyWrapper.promises.apiRequest.restore()
    })

    it('sends correct XML', function () {
      this.apiRequest.called.should.equal(true)
      const { body } = this.apiRequest.lastCall.args[0]
      expect(body).to.equal(`\
<subscription>
	<plan_code>silver</plan_code>
	<timeframe>now</timeframe>
</subscription>\
`)
      this.requestOptions.url.should.equal(
        `subscriptions/${this.recurlySubscriptionId}`
      )
      this.requestOptions.method.should.equal('PUT')
    })

    it('should return the updated subscription', function () {
      expect(this.recurlySubscription).to.exist
      this.recurlySubscription.plan.plan_code.should.equal('gold')
    })
  })

  describe('redeemCoupon', function () {
    beforeEach(async function () {
      this.recurlyAccountId = 'account-id-123'
      this.coupon_code = '312321312'
      this.apiRequest = sinon
        .stub(this.RecurlyWrapper.promises, 'apiRequest')
        .callsFake(options => {
          options.url.should.equal(`coupons/${this.coupon_code}/redeem`)
          options.method.should.equal('POST')
          return {}
        })
      await this.RecurlyWrapper.promises.redeemCoupon(
        this.recurlyAccountId,
        this.coupon_code
      )
    })

    afterEach(function () {
      this.RecurlyWrapper.promises.apiRequest.restore()
    })

    it('sends correct XML', function () {
      this.apiRequest.called.should.equal(true)
      const { body } = this.apiRequest.lastCall.args[0]
      expect(body).to.equal(`\
<redemption>
	<account_code>account-id-123</account_code>
	<currency>USD</currency>
</redemption>\
`)
    })
  })

  describe('createFixedAmountCoupon', function () {
    beforeEach(async function () {
      this.couponCode = 'a-coupon-code'
      this.couponName = 'a-coupon-name'
      this.currencyCode = 'EUR'
      this.discount = 1337
      this.planCode = 'a-plan-code'
      this.apiRequest = sinon
        .stub(this.RecurlyWrapper.promises, 'apiRequest')
        .resolves()
      await this.RecurlyWrapper.promises.createFixedAmountCoupon(
        this.couponCode,
        this.couponName,
        this.currencyCode,
        this.discount,
        this.planCode
      )
    })

    afterEach(function () {
      this.RecurlyWrapper.promises.apiRequest.restore()
    })

    it('sends correct XML', function () {
      this.apiRequest.called.should.equal(true)
      const { body } = this.apiRequest.lastCall.args[0]
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
    beforeEach(function () {
      this.user = {
        _id: 'some_id',
        email: 'user@example.com',
      }
      this.subscriptionDetails = {
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
      this.subscription = {}
      this.recurlyTokenIds = {
        billing: 'a-token-id',
        threeDSecureActionResult: 'a-3d-token-id',
      }
      this.call = () => {
        return this.RecurlyWrapper.promises.createSubscription(
          this.user,
          this.subscriptionDetails,
          this.recurlyTokenIds
        )
      }
    })

    describe('when paypal', function () {
      beforeEach(function () {
        this.subscriptionDetails.isPaypal = true
        this._createPaypalSubscription = sinon.stub(
          this.RecurlyWrapper.promises,
          '_createPaypalSubscription'
        )
        this._createPaypalSubscription.resolves(this.subscription)
      })

      afterEach(function () {
        this._createPaypalSubscription.restore()
      })

      it('should not produce an error', async function () {
        await expect(this.call()).to.be.fulfilled
      })

      it('should produce a subscription object', async function () {
        const sub = await this.call()
        expect(sub).to.deep.equal(this.subscription)
      })

      it('should call _createPaypalSubscription', async function () {
        await this.call()
        this._createPaypalSubscription.callCount.should.equal(1)
      })

      describe('when _createPaypalSubscription produces an error', function () {
        beforeEach(function () {
          this._createPaypalSubscription.rejects(new Error('woops'))
        })

        it('should produce an error', async function () {
          await expect(this.call()).to.be.rejectedWith('woops')
        })
      })
    })

    describe('when not paypal', function () {
      beforeEach(function () {
        this.subscriptionDetails.isPaypal = false
        this._createCreditCardSubscription = sinon.stub(
          this.RecurlyWrapper.promises,
          '_createCreditCardSubscription'
        )
        this._createCreditCardSubscription.resolves(this.subscription)
      })

      afterEach(function () {
        this._createCreditCardSubscription.restore()
      })

      it('should not produce an error', async function () {
        await this.call()
      })

      it('should produce a subscription object', async function () {
        const sub = await this.call()
        expect(sub).to.deep.equal(this.subscription)
      })

      it('should call _createCreditCardSubscription', async function () {
        await this.call()
        this._createCreditCardSubscription.callCount.should.equal(1)
      })

      describe('when _createCreditCardSubscription produces an error', function () {
        beforeEach(function () {
          this._createCreditCardSubscription.rejects(new Error('woops'))
        })

        it('should produce an error', async function () {
          await expect(this.call()).to.be.rejectedWith('woops')
        })
      })
    })
  })

  describe('_createCreditCardSubscription', function () {
    beforeEach(function () {
      this.user = {
        _id: 'some_id',
        email: 'user@example.com',
        first_name: 'Foo',
        last_name: 'Johnson',
      }
      this.subscriptionDetails = {
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
      this.subscription = {}
      this.recurlyTokenIds = {
        billing: 'a-token-id',
        threeDSecureActionResult: 'a-3d-token-id',
      }
      this.apiRequest = sinon.stub(this.RecurlyWrapper.promises, 'apiRequest')
      this.response = { status: 200 }
      this.body = '<xml>is_bad</xml>'
      this.apiRequest.resolves({
        response: this.response,
        body: this.body,
      })
      this._parseSubscriptionXml = sinon.stub(
        this.RecurlyWrapper.promises,
        '_parseSubscriptionXml'
      )
      this._parseSubscriptionXml.resolves(this.subscription)
      this.call = () => {
        return this.RecurlyWrapper.promises._createCreditCardSubscription(
          this.user,
          this.subscriptionDetails,
          this.recurlyTokenIds
        )
      }
    })

    afterEach(function () {
      this.apiRequest.restore()
      this._parseSubscriptionXml.restore()
    })

    it('sends correct XML', async function () {
      await this.call()

      const { body } = this.apiRequest.lastCall.args[0]
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

    it('should not produce an error', async function () {
      await expect(this.call()).to.be.fulfilled
    })

    it('should produce a subscription', async function () {
      const sub = await this.call()
      expect(sub).to.equal(this.subscription)
    })

    it('should call apiRequest', async function () {
      await this.call()
      this.apiRequest.callCount.should.equal(1)
    })

    it('should call _parseSubscriptionXml', async function () {
      await this.call()
      this._parseSubscriptionXml.callCount.should.equal(1)
    })

    describe('when api request returns 422', function () {
      beforeEach(function () {
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
        this.apiRequest.resolves({
          response: { status: 422 },
          body,
        })
      })

      it('should produce an error', function (done) {
        this.call().catch(err => {
          expect(err).to.be.instanceof(
            SubscriptionErrors.RecurlyTransactionError
          )
          expect(err.info.public.message).to.be.equal(
            'Your card must be authenticated with 3D Secure before continuing.'
          )
          expect(err.info.public.threeDSecureActionTokenId).to.be.equal(
            'mock_three_d_secure_action_token'
          )
          done()
        })
      })
    })

    describe('when api request produces an error', function () {
      beforeEach(function () {
        this.apiRequest.rejects(new Error('woops'))
      })

      it('should produce an error', async function () {
        await expect(this.call()).to.be.rejectedWith('woops')
      })

      it('should call apiRequest', async function () {
        await expect(this.call()).to.be.rejected
        this.apiRequest.callCount.should.equal(1)
      })

      it('should not _parseSubscriptionXml', async function () {
        await expect(this.call()).to.be.rejected
        this._parseSubscriptionXml.callCount.should.equal(0)
      })
    })

    describe('when parse xml produces an error', function () {
      beforeEach(function () {
        this._parseSubscriptionXml.rejects(new Error('woops xml'))
      })

      it('should produce an error', async function () {
        await expect(this.call()).to.be.rejectedWith('woops xml')
      })
    })
  })

  describe('_createPaypalSubscription', function () {
    beforeEach(function () {
      this.checkAccountExists = sinon.stub(
        this.RecurlyWrapper.promises._paypal,
        'checkAccountExists'
      )
      this.createAccount = sinon.stub(
        this.RecurlyWrapper.promises._paypal,
        'createAccount'
      )
      this.createBillingInfo = sinon.stub(
        this.RecurlyWrapper.promises._paypal,
        'createBillingInfo'
      )
      this.setAddressAndCompanyBillingInfo = sinon.stub(
        this.RecurlyWrapper.promises._paypal,
        'setAddressAndCompanyBillingInfo'
      )
      this.createSubscription = sinon.stub(
        this.RecurlyWrapper.promises._paypal,
        'createSubscription'
      )
      this.user = {
        _id: 'some_id',
        email: 'user@example.com',
      }
      this.subscriptionDetails = {
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
      this.subscription = {}
      this.recurlyTokenIds = {
        billing: 'a-token-id',
        threeDSecureActionResult: 'a-3d-token-id',
      }

      // set up data callbacks
      const { user } = this
      const { subscriptionDetails } = this
      const { recurlyTokenIds } = this

      this.checkAccountExists.resolves({
        user,
        subscriptionDetails,
        recurlyTokenIds,
        userExists: false,
        account: { accountCode: 'xx' },
      })
      this.createAccount.resolves({
        user,
        subscriptionDetails,
        recurlyTokenIds,
        userExists: false,
        account: { accountCode: 'xx' },
      })
      this.createBillingInfo.resolves({
        user,
        subscriptionDetails,
        recurlyTokenIds,
        userExists: false,
        account: { accountCode: 'xx' },
        billingInfo: { token_id: 'abc' },
      })
      this.setAddressAndCompanyBillingInfo.resolves({
        user,
        subscriptionDetails,
        recurlyTokenIds,
        userExists: false,
        account: { accountCode: 'xx' },
        billingInfo: { token_id: 'abc' },
      })
      this.createSubscription.resolves({
        user,
        subscriptionDetails,
        recurlyTokenIds,
        userExists: false,
        account: { accountCode: 'xx' },
        billingInfo: { token_id: 'abc' },
        subscription: this.subscription,
      })

      this.call = () => {
        return this.RecurlyWrapper.promises._createPaypalSubscription(
          this.user,
          this.subscriptionDetails,
          this.recurlyTokenIds
        )
      }
    })

    afterEach(function () {
      this.checkAccountExists.restore()
      this.createAccount.restore()
      this.createBillingInfo.restore()
      this.setAddressAndCompanyBillingInfo.restore()
      this.createSubscription.restore()
    })

    it('should not produce an error', async function () {
      await expect(this.call()).to.be.fulfilled
    })

    it('should produce a subscription object', async function () {
      const sub = await this.call()
      expect(sub).to.not.equal(null)
      expect(sub).to.equal(this.subscription)
    })

    it('should call each of the paypal stages', async function () {
      await this.call()
      this.checkAccountExists.callCount.should.equal(1)
      this.createAccount.callCount.should.equal(1)
      this.createBillingInfo.callCount.should.equal(1)
      this.setAddressAndCompanyBillingInfo.callCount.should.equal(1)
      this.createSubscription.callCount.should.equal(1)
    })

    describe('when one of the paypal stages produces an error', function () {
      beforeEach(function () {
        this.createAccount.rejects(new Error('woops'))
      })

      it('should produce an error', async function () {
        await expect(this.call()).to.be.rejectedWith('woops')
      })

      it('should stop calling the paypal stages after the error', async function () {
        await expect(this.call()).to.be.rejected
        this.checkAccountExists.callCount.should.equal(1)
        this.createAccount.callCount.should.equal(1)
        this.createBillingInfo.callCount.should.equal(0)
        this.setAddressAndCompanyBillingInfo.callCount.should.equal(0)
        this.createSubscription.callCount.should.equal(0)
      })
    })
  })

  describe('paypal actions', function () {
    beforeEach(function () {
      this.apiRequest = sinon.stub(this.RecurlyWrapper.promises, 'apiRequest')
      this._parseAccountXml = sinon.spy(
        this.RecurlyWrapper.promises,
        '_parseAccountXml'
      )
      this._parseBillingInfoXml = sinon.spy(
        this.RecurlyWrapper.promises,
        '_parseBillingInfoXml'
      )
      this._parseSubscriptionXml = sinon.spy(
        this.RecurlyWrapper.promises,
        '_parseSubscriptionXml'
      )
      this.cache = {
        user: (this.user = {
          _id: 'some_id',
          email: 'foo@bar.com',
          first_name: 'Foo',
          last_name: 'Bar',
        }),
        recurlyTokenIds: (this.recurlyTokenIds = {
          billing: 'a-token-id',
          threeDSecureActionResult: 'a-3d-token-id',
        }),
        subscriptionDetails: (this.subscriptionDetails = {
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

    afterEach(function () {
      this.apiRequest.restore()
      this._parseAccountXml.restore()
      this._parseBillingInfoXml.restore()
      this._parseSubscriptionXml.restore()
    })

    describe('_paypal.checkAccountExists', function () {
      beforeEach(function () {
        this.call = () => {
          return this.RecurlyWrapper.promises._paypal.checkAccountExists(
            this.cache
          )
        }
      })

      describe('when the account exists', function () {
        beforeEach(function () {
          const resultXml =
            '<account><account_code>abc</account_code></account>'
          this.apiRequest.resolves({
            response: { status: 200 },
            body: resultXml,
          })
        })

        it('should not produce an error', async function () {
          await expect(this.call()).to.be.fulfilled
        })

        it('should call apiRequest', async function () {
          await this.call()
          this.apiRequest.callCount.should.equal(1)
        })

        it('should call _parseAccountXml', async function () {
          await this.call()
          this.RecurlyWrapper.promises._parseAccountXml.callCount.should.equal(
            1
          )
        })

        it('should add the account to the cumulative result', async function () {
          const result = await this.call()
          expect(result.account).to.not.equal(null)
          expect(result.account).to.not.equal(undefined)
          expect(result.account).to.deep.equal({
            account_code: 'abc',
          })
        })

        it('should set userExists to true', async function () {
          const result = await this.call()
          expect(result.userExists).to.equal(true)
        })
      })

      describe('when the account does not exist', function () {
        beforeEach(function () {
          this.apiRequest.resolves({
            response: { status: 404 },
            body: '',
          })
        })

        it('should not produce an error', async function () {
          await expect(this.call()).to.be.fulfilled
        })

        it('should call apiRequest', async function () {
          await this.call()
          this.apiRequest.callCount.should.equal(1)
          this.apiRequest.firstCall.args[0].method.should.equal('GET')
        })

        it('should not call _parseAccountXml', async function () {
          await this.call()
          this.RecurlyWrapper.promises._parseAccountXml.callCount.should.equal(
            0
          )
        })

        it('should not add the account to result', async function () {
          const result = await this.call()
          expect(result.account).to.equal(undefined)
        })

        it('should set userExists to false', async function () {
          const result = await this.call()
          expect(result.userExists).to.equal(false)
        })
      })

      describe('when apiRequest produces an error', function () {
        beforeEach(function () {
          this.apiRequest.rejects(new Error('woops'))
        })

        it('should produce an error', async function () {
          await expect(this.call()).to.be.rejected
        })
      })
    })

    describe('_paypal.createAccount', function () {
      beforeEach(function () {
        this.call = () => {
          return this.RecurlyWrapper.promises._paypal.createAccount(this.cache)
        }
      })

      describe('when address is missing from subscriptionDetails', function () {
        beforeEach(function () {
          this.cache.subscriptionDetails.address = null
        })

        it('should produce an error', async function () {
          await expect(this.call()).to.be.rejected
        })
      })

      describe('when country is missing from address', function () {
        beforeEach(function () {
          this.cache.subscriptionDetails.address = {}
        })

        it('should produce an error', async function () {
          await expect(this.call()).to.be.rejectedWith(Errors.InvalidError)
        })
      })

      describe('when account already exists', function () {
        beforeEach(function () {
          this.cache.userExists = true
          this.cache.account = { account_code: 'abc' }
        })

        it('should not produce an error', async function () {
          await expect(this.call()).to.be.fulfilled
        })

        it('should produce cache object', async function () {
          const result = await this.call()
          expect(result).to.deep.equal(this.cache)
          expect(result.account).to.deep.equal({
            account_code: 'abc',
          })
        })

        it('should not call apiRequest', async function () {
          await expect(this.call()).to.be.fulfilled
          this.apiRequest.callCount.should.equal(0)
        })

        it('should not call _parseAccountXml', async function () {
          await this.call()
          this.RecurlyWrapper.promises._parseAccountXml.callCount.should.equal(
            0
          )
        })
      })

      describe('when account does not exist', function () {
        beforeEach(function () {
          this.cache.userExists = false
          const resultXml =
            '<account><account_code>abc</account_code></account>'
          this.apiRequest.resolves({
            response: { status: 200 },
            body: resultXml,
          })
        })

        it('sends correct XML', async function () {
          await this.call()
          const { body } = this.apiRequest.lastCall.args[0]
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

        it('should not produce an error', async function () {
          await expect(this.call()).to.be.fulfilled
        })

        it('should call apiRequest', async function () {
          await this.call()
          this.apiRequest.callCount.should.equal(1)
          this.apiRequest.firstCall.args[0].method.should.equal('POST')
        })

        it('should call _parseAccountXml', async function () {
          await this.call()
          this.RecurlyWrapper.promises._parseAccountXml.callCount.should.equal(
            1
          )
        })

        describe('when apiRequest produces an error', function () {
          beforeEach(function () {
            this.apiRequest.rejects(new Error('woops'))
          })

          it('should produce an error', async function () {
            await expect(this.call()).to.be.rejectedWith('woops')
          })
        })
      })
    })

    describe('_paypal.createBillingInfo', function () {
      beforeEach(function () {
        this.cache.account = { account_code: 'abc' }
        this.call = () => {
          return this.RecurlyWrapper.promises._paypal.createBillingInfo(
            this.cache
          )
        }
      })

      describe('when account_code is missing from cache', function () {
        beforeEach(function () {
          this.cache.account.account_code = null
        })

        it('should produce an error', async function () {
          await expect(this.call()).to.be.rejected
        })
      })

      describe('when all goes well', function () {
        beforeEach(function () {
          const resultXml = '<billing_info><a>1</a></billing_info>'
          this.apiRequest.resolves({
            response: { status: 200 },
            body: resultXml,
          })
        })

        it('sends correct XML', async function () {
          await this.call()
          const { body } = this.apiRequest.lastCall.args[0]
          expect(body).to.equal(`\
<billing_info>
	<token_id>a-token-id</token_id>
</billing_info>\
`)
        })

        it('should not produce an error', async function () {
          await expect(this.call()).to.be.fulfilled
        })

        it('should call apiRequest', async function () {
          await this.call()
          this.apiRequest.callCount.should.equal(1)
          this.apiRequest.firstCall.args[0].method.should.equal('POST')
        })

        it('should call _parseBillingInfoXml', async function () {
          await this.call()
          this.RecurlyWrapper.promises._parseBillingInfoXml.callCount.should.equal(
            1
          )
        })

        it('should set billingInfo on cache', async function () {
          const result = await this.call()
          expect(result.billingInfo).to.deep.equal({
            a: '1',
          })
        })
      })

      describe('when apiRequest produces an error', function () {
        beforeEach(function () {
          this.apiRequest.resolves(new Error('woops'))
        })

        it('should produce an error', async function () {
          await expect(this.call()).to.be.rejected
        })
      })
    })

    describe('_paypal.setAddressAndCompanyBillingInfo', function () {
      beforeEach(function () {
        this.cache.account = { account_code: 'abc' }
        this.cache.billingInfo = {}
        this.call = () => {
          return this.RecurlyWrapper.promises._paypal.setAddressAndCompanyBillingInfo(
            this.cache
          )
        }
      })

      describe('when account_code is missing from cache', function () {
        beforeEach(function () {
          this.cache.account.account_code = null
        })

        it('should produce an error', async function () {
          await expect(this.call()).to.be.rejected
        })
      })

      describe('when country is missing', function () {
        beforeEach(function () {
          this.cache.subscriptionDetails.address = { country: '' }
        })

        it('should produce an error', async function () {
          await expect(this.call()).to.be.rejectedWith(Errors.InvalidError)
        })
      })

      describe('when all goes well', function () {
        beforeEach(function () {
          const resultXml = '<billing_info><city>London</city></billing_info>'
          this.apiRequest.resolves({
            response: { status: 200 },
            body: resultXml,
          })
        })

        it('sends correct XML', async function () {
          await this.call()
          const { body } = this.apiRequest.lastCall.args[0]
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

        it('should not produce an error', async function () {
          await expect(this.call()).to.be.fulfilled
        })

        it('should call apiRequest', async function () {
          await this.call()
          this.apiRequest.callCount.should.equal(1)
          this.apiRequest.firstCall.args[0].method.should.equal('PUT')
        })

        it('should call _parseBillingInfoXml', async function () {
          await this.call()
          this.RecurlyWrapper.promises._parseBillingInfoXml.callCount.should.equal(
            1
          )
        })

        it('should set billingInfo on cache', async function () {
          const result = await this.call()
          expect(result.billingInfo).to.deep.equal({
            city: 'London',
          })
        })
      })

      describe('when apiRequest produces an error', function () {
        beforeEach(function () {
          this.apiRequest.rejects(new Error('woops'))
        })

        it('should produce an error', async function () {
          await expect(this.call()).to.be.rejected
        })
      })
    })

    describe('_paypal.createSubscription', function () {
      beforeEach(function () {
        this.cache.account = { account_code: 'abc' }
        this.cache.billingInfo = {}
        this.call = () =>
          this.RecurlyWrapper.promises._paypal.createSubscription(this.cache)
      })

      describe('when all goes well', function () {
        beforeEach(function () {
          const resultXml = '<subscription><a>1</a></subscription>'
          this.apiRequest.resolves({
            response: { status: 200 },
            body: resultXml,
          })
        })

        it('sends correct XML', async function () {
          await this.call()
          const { body } = this.apiRequest.lastCall.args[0]
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

        it('should not produce an error', async function () {
          await expect(this.call()).to.be.fulfilled
        })

        it('should call apiRequest', async function () {
          await this.call()
          this.apiRequest.callCount.should.equal(1)
          this.apiRequest.firstCall.args[0].method.should.equal('POST')
        })

        it('should call _parseSubscriptionXml', async function () {
          await this.call()
          this.RecurlyWrapper.promises._parseSubscriptionXml.callCount.should.equal(
            1
          )
        })

        it('should set subscription on cache', async function () {
          const result = await this.call()
          expect(result.subscription).to.deep.equal({
            a: '1',
          })
        })
      })

      describe('when apiRequest produces an error', function () {
        beforeEach(function () {
          this.apiRequest.rejects(new Error('woops'))
        })

        it('should produce an error', async function () {
          await expect(this.call()).to.be.rejected
        })
      })
    })
  })

  describe('listAccountActiveSubscriptions', function () {
    beforeEach(function () {
      this.user_id = 'mock-user-id'
      this.response = { mock: 'response' }
      this.body = '<mock body/>'
      this.RecurlyWrapper.promises.apiRequest = sinon.stub().resolves({
        response: this.response,
        body: this.body,
      })
      this.subscriptions = ['mock', 'subscriptions']
      this.RecurlyWrapper.promises._parseSubscriptionsXml = sinon
        .stub()
        .resolves(this.subscriptions)
    })

    describe('with an account', function () {
      beforeEach(async function () {
        this.result =
          await this.RecurlyWrapper.promises.listAccountActiveSubscriptions(
            this.user_id
          )
      })

      it('should send a request to Recurly', async function () {
        this.RecurlyWrapper.promises.apiRequest
          .calledWith({
            url: `accounts/${this.user_id}/subscriptions`,
            qs: {
              state: 'active',
            },
            expect404: true,
          })
          .should.equal(true)
      })

      it('should return the subscriptions', async function () {
        expect(this.result).to.deep.equal(this.subscriptions)
      })
    })

    describe('without an account', function () {
      beforeEach(async function () {
        this.response.status = 404
        this.accountActiveSubscriptions =
          await this.RecurlyWrapper.promises.listAccountActiveSubscriptions(
            this.user_id
          )
      })

      it('should return an empty array of subscriptions', function () {
        expect(this.accountActiveSubscriptions).to.deep.equal([])
      })
    })
  })
})
