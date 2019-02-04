SandboxedModule = require('sandboxed-module')
sinon = require 'sinon'
should = require("chai").should()
expect = require("chai").expect
MockRequest = require "../helpers/MockRequest"
MockResponse = require "../helpers/MockResponse"
modulePath = '../../../../app/js/Features/Subscription/SubscriptionController'

mockSubscriptions =
	"subscription-123-active":
		uuid: "subscription-123-active"
		plan:
			name: "Gold"
			plan_code: "gold"
		current_period_ends_at: new Date()
		state: "active"
		unit_amount_in_cents: 999
		account:
			account_code: "user-123"

describe "SubscriptionController", ->
	beforeEach ->
		@user = {email:"tom@yahoo.com", _id: 'one', signUpDate: new Date('2000-10-01')}
		@activeRecurlySubscription = mockSubscriptions["subscription-123-active"]

		@AuthenticationController =
			getLoggedInUser: sinon.stub().callsArgWith(1, null, @user)
			getLoggedInUserId: sinon.stub().returns(@user._id)
			getSessionUser: sinon.stub().returns(@user)
			isUserLoggedIn: sinon.stub().returns(true)
		@SubscriptionHandler =
			createSubscription: sinon.stub().callsArgWith(3)
			updateSubscription: sinon.stub().callsArgWith(3)
			reactivateSubscription: sinon.stub().callsArgWith(1)
			cancelSubscription: sinon.stub().callsArgWith(1)
			recurlyCallback: sinon.stub().callsArgWith(1)
			startFreeTrial: sinon.stub()

		@PlansLocator =
			findLocalPlanInSettings: sinon.stub()

		@LimitationsManager =
			hasPaidSubscription: sinon.stub()
			userHasV1OrV2Subscription : sinon.stub()
			userHasV2Subscription: sinon.stub()

		@SubscriptionViewModelBuilder =
			buildUsersSubscriptionViewModel:sinon.stub().callsArgWith(1, null, {})
			buildViewModel: sinon.stub()
		@settings =
			coupon_codes:
				upgradeToAnnualPromo:
					student:"STUDENTCODEHERE"
					collaborator:"COLLABORATORCODEHERE"
			apis:
				recurly:
					subdomain:"sl"
			siteUrl: "http://de.sharelatex.dev:3000"
			gaExperiments:{}
		@GeoIpLookup =
			getCurrencyCode:sinon.stub()
		@UserGetter =
			getUser: sinon.stub().callsArgWith(2, null, @user)
		@SubscriptionController = SandboxedModule.require modulePath, requires:
			'../Authentication/AuthenticationController': @AuthenticationController
			'./SubscriptionHandler': @SubscriptionHandler
			"./PlansLocator": @PlansLocator
			'./SubscriptionViewModelBuilder': @SubscriptionViewModelBuilder
			"./LimitationsManager": @LimitationsManager
			"../../infrastructure/GeoIpLookup":@GeoIpLookup
			"logger-sharelatex":
				log:->
				warn:->
			"settings-sharelatex": @settings
			"../User/UserGetter": @UserGetter
			"./RecurlyWrapper": @RecurlyWrapper = {}
			"./FeaturesUpdater": @FeaturesUpdater = {}
			"./GroupPlansData": @GroupPlansData = {}
			"./V1SubscriptionManager": @V1SubscriptionManager = {}


		@res = new MockResponse()
		@req = new MockRequest()
		@req.body = {}
		@req.query =
			planCode:"123123"

		@stubbedCurrencyCode = "GBP"

	describe "plansPage", ->
		beforeEach ->
			@req.ip  = "1234.3123.3131.333 313.133.445.666 653.5345.5345.534"
			@GeoIpLookup.getCurrencyCode.callsArgWith(1, null, @stubbedCurrencyCode)

		describe 'when user is logged in', (done) ->
			beforeEach (done) ->
				@res.callback = done
				@SubscriptionController.plansPage(@req, @res)
			it 'should fetch the current user', (done) ->
				@UserGetter.getUser.callCount.should.equal 1
				done()

			describe 'not dependant on logged in state', (done) ->
				# these could have been put in 'when user is not logged in' too
				it "should set the recommended currency from the geoiplookup", (done)->
					@res.renderedVariables.recomendedCurrency.should.equal(@stubbedCurrencyCode)
					@GeoIpLookup.getCurrencyCode.calledWith(@req.ip).should.equal true
					done()
				it 'should include data for features table', (done) ->
					@res.renderedVariables.planFeatures.length.should.not.equal 0
					done()

		describe 'when user is not logged in', (done) ->
			beforeEach (done) ->
				@res.callback = done
				@AuthenticationController.getLoggedInUserId = sinon.stub().returns(null)
				@SubscriptionController.plansPage(@req, @res)

			it 'should not fetch the current user', (done) ->
				@UserGetter.getUser.callCount.should.equal 0
				done()

	describe "paymentPage", ->
		beforeEach ->
			@req.headers = {}
			@RecurlyWrapper.sign = sinon.stub().yields(null, @signature = "signature")
			@SubscriptionHandler.validateNoSubscriptionInRecurly = sinon.stub().yields(null, true)
			@GeoIpLookup.getCurrencyCode.callsArgWith(1, null, @stubbedCurrencyCode)

		describe "with a user without a subscription", ->
			beforeEach ->
				@LimitationsManager.userHasV1OrV2Subscription.callsArgWith(1, null, false)
				@PlansLocator.findLocalPlanInSettings.returns({})

			describe "with a valid plan code", ->

				it "should render the new subscription page", (done)->
					@res.render = (page, opts)=>
						page.should.equal "subscriptions/new"
						done()
					@SubscriptionController.paymentPage @req, @res

		describe "with a user with subscription", ->
			it "should redirect to the subscription dashboard", (done)->
				@LimitationsManager.userHasV1OrV2Subscription.callsArgWith(1, null, true)
				@res.redirect = (url)=>
					url.should.equal "/user/subscription?hasSubscription=true"
					done()
				@SubscriptionController.paymentPage(@req, @res)

		describe "with an invalid plan code", ->
			it "should redirect to the subscription dashboard", (done)->
				@LimitationsManager.userHasV1OrV2Subscription.callsArgWith(1, null, false)
				@PlansLocator.findLocalPlanInSettings.returns(null)
				@res.redirect = (url)=>
					url.should.equal "/user/subscription?hasSubscription=true"
					done()
				@SubscriptionController.paymentPage(@req, @res)

		describe "which currency to use", ->
			beforeEach ->
				@LimitationsManager.userHasV1OrV2Subscription.callsArgWith(1, null, false)
				@PlansLocator.findLocalPlanInSettings.returns({})

			it "should use the set currency from the query string", (done)->
				@req.query.currency = "EUR"
				@res.render = (page, opts)=>
					opts.currency.should.equal "EUR"
					opts.currency.should.not.equal @stubbedCurrencyCode
					done()
				@SubscriptionController.paymentPage @req, @res

			it "should upercase the currency code", (done)->
				@req.query.currency = "eur"
				@res.render = (page, opts)=>
					opts.currency.should.equal "EUR"
					done()
				@SubscriptionController.paymentPage @req, @res


			it "should use the geo ip currency if non is provided", (done)->
				@req.query.currency = null
				@res.render = (page, opts)=>
					opts.currency.should.equal @stubbedCurrencyCode
					done()
				@SubscriptionController.paymentPage @req, @res

		describe "with a recurly subscription already", ->
			it "should redirect to the subscription dashboard", (done)->
				@LimitationsManager.userHasV1OrV2Subscription.callsArgWith(1, null, false)
				@SubscriptionHandler.validateNoSubscriptionInRecurly = sinon.stub().yields(null, false)
				@res.redirect = (url)=>
					url.should.equal "/user/subscription?hasSubscription=true"
					done()
				@SubscriptionController.paymentPage(@req, @res)


	describe "successful_subscription", ->
		beforeEach (done) ->
			@SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel.callsArgWith(1, null, {})
			@res.callback = done
			@SubscriptionController.successful_subscription @req, @res

	describe "userSubscriptionPage", ->
		beforeEach (done) ->
			@SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel.callsArgWith(1, null, {
				personalSubscription: @personalSubscription = { 'personal-subscription': 'mock' }
				memberGroupSubscriptions: @memberGroupSubscriptions = { 'group-subscriptions': 'mock' }
			})
			@SubscriptionViewModelBuilder.buildViewModel.returns(@plans = {'plans': 'mock'})
			@LimitationsManager.userHasV1OrV2Subscription.callsArgWith(1, null, false)
			@res.render = (view, @data) =>
				expect(view).to.equal 'subscriptions/dashboard'
				done()
			@SubscriptionController.userSubscriptionPage @req, @res

		it "should load the personal, groups and v1 subscriptions", ->
			expect(@data.personalSubscription).to.deep.equal @personalSubscription
			expect(@data.memberGroupSubscriptions).to.deep.equal @memberGroupSubscriptions

		it "should load the user", ->
			expect(@data.user).to.deep.equal @user

		it "should load the plans", ->
			expect(@data.plans).to.deep.equal @plans

	describe "createSubscription", ->
		beforeEach (done)->
			@res =
				sendStatus:->
					done()
			sinon.spy @res, "sendStatus"
			@subscriptionDetails =
				card:"1234"
				cvv:"123"
			@req.body.recurly_token_id = "1234"
			@req.body.subscriptionDetails = @subscriptionDetails
			@LimitationsManager.userHasV1OrV2Subscription.yields(null, false)
			@SubscriptionController.createSubscription @req, @res

		it "should send the user and subscriptionId to the handler", (done)->
			@SubscriptionHandler.createSubscription.calledWith(@user, @subscriptionDetails, @req.body.recurly_token_id).should.equal true
			done()

		it "should redurect to the subscription page", (done)->
			@res.sendStatus.calledWith(201).should.equal true
			done()


	describe "updateSubscription via post", ->
		beforeEach (done)->
			@res =
				redirect:->
					done()
			sinon.spy @res, "redirect"
			@plan_code = "1234"
			@req.body.plan_code = @plan_code
			@SubscriptionController.updateSubscription @req, @res

		it "should send the user and subscriptionId to the handler", (done)->
			@SubscriptionHandler.updateSubscription.calledWith(@user, @plan_code).should.equal true
			done()

		it "should redurect to the subscription page", (done)->
			@res.redirect.calledWith("/user/subscription").should.equal true
			done()

	describe "reactivateSubscription", ->
		beforeEach (done)->
			@res =
				redirect:->
					done()
			sinon.spy @res, "redirect"
			@SubscriptionController.reactivateSubscription @req, @res

		it "should tell the handler to reactivate this user", (done)->
			@SubscriptionHandler.reactivateSubscription.calledWith(@user).should.equal true
			done()

		it "should redurect to the subscription page", (done)->
			@res.redirect.calledWith("/user/subscription").should.equal true
			done()

	describe "cancelSubscription", ->
		beforeEach (done)->
			@res =
				redirect:->
					done()
			sinon.spy @res, "redirect"
			@SubscriptionController.cancelSubscription @req, @res

		it "should tell the handler to cancel this user", (done)->
			@SubscriptionHandler.cancelSubscription.calledWith(@user).should.equal true
			done()

		it "should redurect to the subscription page", (done)->
			@res.redirect.calledWith("/user/subscription").should.equal true
			done()

	describe "recurly callback", ->
		describe "with a actionable request", ->

			beforeEach (done)->
				@req =
					body:
						expired_subscription_notification:
							subscription:
								uuid: @activeRecurlySubscription.uuid
				@res = sendStatus:->
					done()
				sinon.spy @res, "sendStatus"
				@SubscriptionController.recurlyCallback @req, @res

			it "should tell the SubscriptionHandler to process the recurly callback", (done)->
				@SubscriptionHandler.recurlyCallback.called.should.equal true
				done()


			it "should send a 200", (done)->
				@res.sendStatus.calledWith(200)
				done()

		describe "with a non-actionable request", ->
			beforeEach (done) ->
				@user.id = @activeRecurlySubscription.account.account_code
				@req =
					body:
						new_subscription_notification:
							subscription:
								uuid: @activeRecurlySubscription.uuid
				@res = sendStatus:->
					done()
				sinon.spy @res, "sendStatus"
				@SubscriptionController.recurlyCallback @req, @res

			it "should not call the subscriptionshandler", ->
				@SubscriptionHandler.recurlyCallback.called.should.equal false

			it "should respond with a 200 status", ->
				@res.sendStatus.calledWith(200)


	describe "renderUpgradeToAnnualPlanPage", ->


		it "should redirect to the plans page if the user does not have a subscription", (done)->
			@LimitationsManager.userHasV2Subscription.callsArgWith(1, null, false)
			@res.redirect = (url)->
				url.should.equal "/user/subscription/plans"
				done()
			@SubscriptionController.renderUpgradeToAnnualPlanPage @req, @res


		it "should pass the plan code to the view - student", (done)->

			@LimitationsManager.userHasV2Subscription.callsArgWith(1, null, true, {planCode:"Student free trial 14 days"})
			@res.render = (view, opts)->
				view.should.equal "subscriptions/upgradeToAnnual"
				opts.planName.should.equal "student"
				done()
			@SubscriptionController.renderUpgradeToAnnualPlanPage @req, @res

		it "should pass the plan code to the view - collaborator", (done)->

			@LimitationsManager.userHasV2Subscription.callsArgWith(1, null, true, {planCode:"free trial for Collaborator free trial 14 days"})
			@res.render = (view, opts)->
				opts.planName.should.equal "collaborator"
				done()
			@SubscriptionController.renderUpgradeToAnnualPlanPage @req, @res

		it "should pass annual as the plan name if the user is already on an annual plan", (done)->

			@LimitationsManager.userHasV2Subscription.callsArgWith(1, null, true, {planCode:"student annual with free trial"})
			@res.render = (view, opts)->
				opts.planName.should.equal "annual"
				done()
			@SubscriptionController.renderUpgradeToAnnualPlanPage @req, @res


	describe "processUpgradeToAnnualPlan", ->

		beforeEach ->

		it "should tell the subscription handler to update the subscription with the annual plan and apply a coupon code", (done)->
			@req.body =
				planName:"student"

			@res.sendStatus = ()=>
				@SubscriptionHandler.updateSubscription.calledWith(@user, "student-annual", "STUDENTCODEHERE").should.equal true
				done()

			@SubscriptionController.processUpgradeToAnnualPlan @req, @res

		it "should get the collaborator coupon code", (done)->

			@req.body =
				planName:"collaborator"

			@res.sendStatus = (url)=>
				@SubscriptionHandler.updateSubscription.calledWith(@user, "collaborator-annual", "COLLABORATORCODEHERE").should.equal true
				done()

			@SubscriptionController.processUpgradeToAnnualPlan @req, @res
