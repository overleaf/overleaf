should = require('chai').should()
sinon = require 'sinon'
crypto = require 'crypto'
querystring = require 'querystring'
RecurlyWrapper = require "../../../../app/js/Features/Subscription/RecurlyWrapper"
Settings = require "settings-sharelatex"
tk = require("timekeeper")

fixtures =
	"subscriptions/44f83d7cba354d5b84812419f923ea96":
		"<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
		"<subscription href=\"https://api.recurly.com/v2/subscriptions/44f83d7cba354d5b84812419f923ea96\">" +
		"  <account href=\"https://api.recurly.com/v2/accounts/104\"/>" +
		"  <plan href=\"https://api.recurly.com/v2/plans/gold\">" +
		"    <plan_code>gold</plan_code>" +
		"    <name>Gold plan</name>" +
		"  </plan>" +
		"  <uuid>44f83d7cba354d5b84812419f923ea96</uuid>" +
		"  <state>active</state>" +
		"  <unit_amount_in_cents type=\"integer\">800</unit_amount_in_cents>" +
		"  <currency>EUR</currency>" +
		"  <quantity type=\"integer\">1</quantity>" +
		"  <activated_at type=\"datetime\">2011-05-27T07:00:00Z</activated_at>" +
		"  <canceled_at nil=\"nil\"></canceled_at>" +
		"  <expires_at nil=\"nil\"></expires_at>" +
		"  <current_period_started_at type=\"datetime\">2011-06-27T07:00:00Z</current_period_started_at>" +
		"  <current_period_ends_at type=\"datetime\">2011-07-27T07:00:00Z</current_period_ends_at>" +
		"  <trial_started_at nil=\"nil\"></trial_started_at>" +
		"  <trial_ends_at nil=\"nil\"></trial_ends_at>" +
		"  <subscription_add_ons type=\"array\">" +
		"    <subscription_add_on>" +
		"      <add_on_code>ipaddresses</add_on_code>" +
		"      <quantity>10</quantity>" +
		"      <unit_amount_in_cents>150</unit_amount_in_cents>" +
		"    </subscription_add_on>" +
		"  </subscription_add_ons>" +
		"  <a name=\"cancel\" href=\"https://api.recurly.com/v2/subscriptions/44f83d7cba354d5b84812419f923ea96/cancel\" method=\"put\"/>" +
		"  <a name=\"terminate\" href=\"https://api.recurly.com/v2/subscriptions/44f83d7cba354d5b84812419f923ea96/terminate\" method=\"put\"/>" +
		"  <a name=\"postpone\" href=\"https://api.recurly.com/v2/subscriptions/44f83d7cba354d5b84812419f923ea96/postpone\" method=\"put\"/>" +
		"</subscription>"
	"recurly_js/result/70db44b10f5f4b238669480c9903f6f5":
		"<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
		"<subscription href=\"https://api.recurly.com/v2/subscriptions/44f83d7cba354d5b84812419f923ea96\">" +
		"  <account href=\"https://api.recurly.com/v2/accounts/104\"/>" +
		"  <plan href=\"https://api.recurly.com/v2/plans/gold\">" +
		"    <plan_code>gold</plan_code>" +
		"    <name>Gold plan</name>" +
		"  </plan>" +
		"  <uuid>44f83d7cba354d5b84812419f923ea96</uuid>" +
		"  <state>active</state>" +
		"  <unit_amount_in_cents type=\"integer\">800</unit_amount_in_cents>" +
		"  <currency>EUR</currency>" +
		"  <quantity type=\"integer\">1</quantity>" +
		"  <activated_at type=\"datetime\">2011-05-27T07:00:00Z</activated_at>" +
		"  <canceled_at nil=\"nil\"></canceled_at>" +
		"  <expires_at nil=\"nil\"></expires_at>" +
		"  <current_period_started_at type=\"datetime\">2011-06-27T07:00:00Z</current_period_started_at>" +
		"  <current_period_ends_at type=\"datetime\">2011-07-27T07:00:00Z</current_period_ends_at>" +
		"  <trial_started_at nil=\"nil\"></trial_started_at>" +
		"  <trial_ends_at nil=\"nil\"></trial_ends_at>" +
		"  <subscription_add_ons type=\"array\">" +
		"    <subscription_add_on>" +
		"      <add_on_code>ipaddresses</add_on_code>" +
		"      <quantity>10</quantity>" +
		"      <unit_amount_in_cents>150</unit_amount_in_cents>" +
		"    </subscription_add_on>" +
		"  </subscription_add_ons>" +
		"  <a name=\"cancel\" href=\"https://api.recurly.com/v2/subscriptions/44f83d7cba354d5b84812419f923ea96/cancel\" method=\"put\"/>" +
		"  <a name=\"terminate\" href=\"https://api.recurly.com/v2/subscriptions/44f83d7cba354d5b84812419f923ea96/terminate\" method=\"put\"/>" +
		"  <a name=\"postpone\" href=\"https://api.recurly.com/v2/subscriptions/44f83d7cba354d5b84812419f923ea96/postpone\" method=\"put\"/>" +
		"</subscription>"
	"accounts/104":
		"<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
		"<account href=\"https://api.recurly.com/v2/accounts/104\">" +
		"  <adjustments href=\"https://api.recurly.com/v2/accounts/1/adjustments\"/>" +
		"  <billing_info href=\"https://api.recurly.com/v2/accounts/1/billing_info\"/>" +
		"  <invoices href=\"https://api.recurly.com/v2/accounts/1/invoices\"/>" +
		"  <redemption href=\"https://api.recurly.com/v2/accounts/1/redemption\"/>" +
		"  <subscriptions href=\"https://api.recurly.com/v2/accounts/1/subscriptions\"/>" +
		"  <transactions href=\"https://api.recurly.com/v2/accounts/1/transactions\"/>" +
		"  <account_code>104</account_code>" +
		"  <state>active</state>" +
		"  <username nil=\"nil\"></username>" +
		"  <email>verena@example.com</email>" +
		"  <first_name>Verena</first_name>" +
		"  <last_name>Example</last_name>" +
		"  <accept_language nil=\"nil\"></accept_language>" +
		"  <hosted_login_token>a92468579e9c4231a6c0031c4716c01d</hosted_login_token>" +
		"  <created_at type=\"datetime\">2011-10-25T12:00:00</created_at>" +
		"</account>"

mockApiRequest = (options, callback) ->
	if fixtures[options.url]
		callback(null, {statusCode : 200}, fixtures[options.url])
	else
		callback("Not found", {statusCode : 404})


describe "RecurlyWrapper", ->
	beforeEach ->
		Settings.plans = [{
			planCode: "collaborator"
			name: "Collaborator"
			features:
				collaborators: -1
				versioning: true
		}]
		Settings.defaultPlanCode =
			collaborators: 0
			versioning: false
		tk.freeze(Date.now())
	
	afterEach -> 
		tk.reset()
	
	describe "sign", ->
		before (done) ->
			RecurlyWrapper.sign({
				subscription :
					plan_code : "gold"
					name      : "$$$"
			}, (error, signature) =>
				@signature = signature
				done()
			)

		it "should be signed correctly", ->
			signed = @signature.split("|")[0]
			query = @signature.split("|")[1]
			crypto.createHmac("sha1", Settings.apis.recurly.privateKey).update(query).digest("hex").should.equal signed

		it "should be url escaped", ->
			query = @signature.split("|")[1]
			should.equal query.match(/\[/), null
			query.match(/\%5B/).should.not.equal null

		it "should contain the passed data", ->
			query = querystring.parse @signature.split("|")[1]
			query["subscription[plan_code]"].should.equal "gold"
			query["subscription[name]"].should.equal "$$$"

		it "should contain a nonce", ->
			query = querystring.parse @signature.split("|")[1]
			should.exist query["nonce"]

		it "should contain a timestamp", ->
			query = querystring.parse @signature.split("|")[1]
			query["timestamp"].should.equal Math.round(Date.now() / 1000) + ""

	describe "_parseXml", ->
		it "should convert different data types into correct representations", (done) ->
			xml =
				"<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
				"<subscription href=\"https://api.recurly.com/v2/subscriptions/44f83d7cba354d5b84812419f923ea96\">" +
				"  <account href=\"https://api.recurly.com/v2/accounts/1\"/>" +
				"  <plan href=\"https://api.recurly.com/v2/plans/gold\">" +
				"    <plan_code>gold</plan_code>" +
				"    <name>Gold plan</name>" +
				"  </plan>" +
				"  <uuid>44f83d7cba354d5b84812419f923ea96</uuid>" +
				"  <state>active</state>" +
				"  <unit_amount_in_cents type=\"integer\">800</unit_amount_in_cents>" +
				"  <currency>EUR</currency>" +
				"  <quantity type=\"integer\">1</quantity>" +
				"  <activated_at type=\"datetime\">2011-05-27T07:00:00Z</activated_at>" +
				"  <canceled_at nil=\"nil\"></canceled_at>" +
				"  <expires_at nil=\"nil\"></expires_at>" +
				"  <current_period_started_at type=\"datetime\">2011-06-27T07:00:00Z</current_period_started_at>" +
				"  <current_period_ends_at type=\"datetime\">2011-07-27T07:00:00Z</current_period_ends_at>" +
				"  <trial_started_at nil=\"nil\"></trial_started_at>" +
				"  <trial_ends_at nil=\"nil\"></trial_ends_at>" +
				"  <subscription_add_ons type=\"array\">" +
				"    <subscription_add_on>" +
				"      <add_on_code>ipaddresses</add_on_code>" +
				"      <quantity>10</quantity>" +
				"      <unit_amount_in_cents>150</unit_amount_in_cents>" +
				"    </subscription_add_on>" +
				"  </subscription_add_ons>" +
				"  <a name=\"cancel\" href=\"https://api.recurly.com/v2/subscriptions/44f83d7cba354d5b84812419f923ea96/cancel\" method=\"put\"/>" +
				"  <a name=\"terminate\" href=\"https://api.recurly.com/v2/subscriptions/44f83d7cba354d5b84812419f923ea96/terminate\" method=\"put\"/>" +
				"  <a name=\"postpone\" href=\"https://api.recurly.com/v2/subscriptions/44f83d7cba354d5b84812419f923ea96/postpone\" method=\"put\"/>" +
				"</subscription>"
			RecurlyWrapper._parseXml xml, (error, data) ->
				data.subscription.plan.plan_code.should.equal "gold"
				data.subscription.plan.name.should.equal "Gold plan"
				data.subscription.uuid.should.equal "44f83d7cba354d5b84812419f923ea96"
				data.subscription.state.should.equal "active"
				data.subscription.unit_amount_in_cents.should.equal 800
				data.subscription.currency.should.equal "EUR"
				data.subscription.quantity.should.equal 1
				data.subscription.activated_at.should.deep.equal new Date("2011-05-27T07:00:00Z")
				should.equal data.subscription.canceled_at, null
				should.equal data.subscription.expires_at, null
				data.subscription.current_period_started_at.should.deep.equal new Date("2011-06-27T07:00:00Z")
				data.subscription.current_period_ends_at.should.deep.equal new Date("2011-07-27T07:00:00Z")
				should.equal data.subscription.trial_started_at, null
				should.equal data.subscription.trial_ends_at, null
				data.subscription.subscription_add_ons.should.deep.equal [{
					add_on_code: "ipaddresses"
					quantity: "10"
					unit_amount_in_cents: "150"
				}]
				data.subscription.account.url.should.equal "https://api.recurly.com/v2/accounts/1"
				data.subscription.url.should.equal "https://api.recurly.com/v2/subscriptions/44f83d7cba354d5b84812419f923ea96"
				data.subscription.plan.url.should.equal "https://api.recurly.com/v2/plans/gold"
				done()
	
	describe "getSubscription", ->
		describe "with proper subscription id", ->
			before ->
				@apiRequest = sinon.stub(RecurlyWrapper, "apiRequest", mockApiRequest)
				RecurlyWrapper.getSubscription "44f83d7cba354d5b84812419f923ea96", (error, recurlySubscription) =>
					@recurlySubscription = recurlySubscription
			after ->
				RecurlyWrapper.apiRequest.restore()
			
			it "should look up the subscription at the normal API end point", ->
				@apiRequest.args[0][0].url.should.equal "subscriptions/44f83d7cba354d5b84812419f923ea96"

			it "should return the subscription", ->
				@recurlySubscription.uuid.should.equal "44f83d7cba354d5b84812419f923ea96"

		describe "with ReculyJS token", ->
			before ->
				@apiRequest = sinon.stub(RecurlyWrapper, "apiRequest", mockApiRequest)
				RecurlyWrapper.getSubscription "70db44b10f5f4b238669480c9903f6f5", {recurlyJsResult: true}, (error, recurlySubscription) =>
					@recurlySubscription = recurlySubscription
			after ->
				RecurlyWrapper.apiRequest.restore()
				
			it "should return the subscription", ->
				@recurlySubscription.uuid.should.equal "44f83d7cba354d5b84812419f923ea96"

			it "should look up the subscription at the RecurlyJS API end point", ->
				@apiRequest.args[0][0].url.should.equal "recurly_js/result/70db44b10f5f4b238669480c9903f6f5"

		describe "with includeAccount", ->
			beforeEach ->
				@apiRequest = sinon.stub(RecurlyWrapper, "apiRequest", mockApiRequest)
				RecurlyWrapper.getSubscription "44f83d7cba354d5b84812419f923ea96", {includeAccount: true}, (error, recurlySubscription) =>
					@recurlySubscription = recurlySubscription
			afterEach ->
				RecurlyWrapper.apiRequest.restore()

			it "should request the account from the API", ->
				@apiRequest.args[1][0].url.should.equal "accounts/104"
				
			it "should populate the account attribute", ->
				@recurlySubscription.account.account_code.should.equal "104"
			

	describe "updateSubscription", ->
		beforeEach (done) ->
			@recurlySubscriptionId = "subscription-id-123"
			@apiRequest = sinon.stub RecurlyWrapper, "apiRequest", (options, callback) =>
				@requestOptions = options
				callback null, {}, fixtures["subscriptions/44f83d7cba354d5b84812419f923ea96"]
			RecurlyWrapper.updateSubscription @recurlySubscriptionId, { plan_code : "silver", timeframe: "now" }, (error, recurlySubscription) =>
				@recurlySubscription = recurlySubscription
				done()
		afterEach ->
			RecurlyWrapper.apiRequest.restore()

		it "should send an update request to the API", ->
			@apiRequest.called.should.equal true
			@requestOptions.body.should.equal """
			                                  <subscription>
			                                    <plan_code>silver</plan_code>
			                                    <timeframe>now</timeframe>
			                                  </subscription>
			                                  """
			@requestOptions.url.should.equal "subscriptions/#{@recurlySubscriptionId}"
			@requestOptions.method.should.equal "put"

		it "should return the updated subscription", ->
			should.exist @recurlySubscription
			@recurlySubscription.plan.plan_code.should.equal "gold"
			

	describe "cancelSubscription", ->
		beforeEach (done) ->
			@recurlySubscriptionId = "subscription-id-123"
			@apiRequest = sinon.stub RecurlyWrapper, "apiRequest", (options, callback) =>
				options.url.should.equal "subscriptions/#{@recurlySubscriptionId}/cancel"
				options.method.should.equal "put"
				callback()
			RecurlyWrapper.cancelSubscription(@recurlySubscriptionId, done)

		afterEach ->
			RecurlyWrapper.apiRequest.restore()

		it "should send a cancel request to the API", ->
			@apiRequest.called.should.equal true
	
	describe "reactivateSubscription", ->
		beforeEach (done) ->
			@recurlySubscriptionId = "subscription-id-123"
			@apiRequest = sinon.stub RecurlyWrapper, "apiRequest", (options, callback) =>
				options.url.should.equal "subscriptions/#{@recurlySubscriptionId}/reactivate"
				options.method.should.equal "put"
				callback()
			RecurlyWrapper.reactivateSubscription(@recurlySubscriptionId, done)

		afterEach ->
			RecurlyWrapper.apiRequest.restore()

		it "should send a cancel request to the API", ->
			@apiRequest.called.should.equal true
	
		

	describe "redeemCoupon", ->

		beforeEach (done) ->
			@recurlyAccountId = "account-id-123"
			@coupon_code = "312321312"
			@apiRequest = sinon.stub RecurlyWrapper, "apiRequest", (options, callback) =>
				options.url.should.equal "coupons/#{@coupon_code}/redeem"
				options.body.indexOf("<account_code>#{@recurlyAccountId}</account_code>").should.not.equal -1
				options.body.indexOf("<currency>USD</currency>").should.not.equal -1
				options.method.should.equal "post"
				callback()
			RecurlyWrapper.redeemCoupon(@recurlyAccountId, @coupon_code, done)

		afterEach ->
			RecurlyWrapper.apiRequest.restore()

		it "should send the request to redem the coupon", ->
			@apiRequest.called.should.equal true
	



