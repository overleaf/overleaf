SandboxedModule = require('sandboxed-module')
sinon = require 'sinon'
should = require("chai").should()
modulePath = '../../../../app/js/Features/Subscription/SubscriptionViewModelBuilder'

describe 'SubscriptionViewModelBuilder', ->
	mockSubscription =
		uuid: "subscription-123-active"
		plan:
			name: "Gold"
			plan_code: "gold"
		current_period_ends_at: new Date()
		state: "active"
		unit_amount_in_cents: 999
		account:
			account_code: "user-123"


	beforeEach ->
		@user =
			email:"tom@yahoo.com",
			_id: 'one',
			signUpDate: new Date('2000-10-01')

		@plan =
			name: "test plan"

		@SubscriptionFormatters =
			formatDate: sinon.stub().returns("Formatted date")
			formatPrice: sinon.stub().returns("Formatted price")

		@RecurlyWrapper =
			sign: sinon.stub().callsArgWith(1, null, "something")
			getSubscription: sinon.stub().callsArgWith	2, null,
				account:
					hosted_login_token: "hosted_login_token"

		@builder = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": { apis: { recurly: { subdomain: "example.com" }}}
			"./RecurlyWrapper": @RecurlyWrapper
			"./PlansLocator": @PlansLocator
			"./SubscriptionLocator": @SubscriptionLocator
			"./SubscriptionFormatters": @SubscriptionFormatters
			"./LimitationsManager": {}
			"logger-sharelatex":
				log:->
				warn:->
			"underscore": {}

		@PlansLocator.findLocalPlanInSettings = sinon.stub().returns(@plan)
		@SubscriptionLocator.getUsersSubscription =  sinon.stub().callsArgWith(1, null, mockSubscription)
		@SubscriptionLocator.getMemberSubscriptions = sinon.stub().callsArgWith(1, null, null)

	it 'builds the user view model', ->
		callback = (error, subscription, memberSubscriptions, billingDetailsLink) =>
			@error = error
			@subscription = subscription
			@memberSubscriptions = memberSubscriptions
			@billingDetailsLink = billingDetailsLink

		@builder.buildUsersSubscriptionViewModel(@user, callback)

		@subscription.name.should.eq 'test plan'
		@subscription.nextPaymentDueAt.should.eq 'Formatted date'
		@subscription.price.should.eq 'Formatted price'
		@billingDetailsLink.should.eq "https://example.com.recurly.com/account/billing_info/edit?ht=hosted_login_token"
