SandboxedModule = require('sandboxed-module')
sinon = require 'sinon'
should = require("chai").should()
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

describe "SubscriptionController sanboxed", ->

	beforeEach ->
		@user = {}
		@activeRecurlySubscription = mockSubscriptions["subscription-123-active"]

		@SecurityManager =
			getCurrentUser: sinon.stub().callsArgWith(1, null, @user)
		@SubscriptionHandler = 
			createSubscription: sinon.stub().callsArgWith(2)
			updateSubscription: sinon.stub().callsArgWith(3)
			reactivateSubscription: sinon.stub().callsArgWith(1)
			cancelSubscription: sinon.stub().callsArgWith(1)
			recurlyCallback: sinon.stub().callsArgWith(1)
			startFreeTrial: sinon.stub()

		@PlansLocator =
			findLocalPlanInSettings: sinon.stub()

		@LimitationsManager = 
			userHasSubscriptionOrIsGroupMember: sinon.stub()
			userHasSubscription : sinon.stub()

		@RecurlyWrapper = 
			sign: sinon.stub().callsArgWith(1, null, "somthing")

		@SubscriptionViewModelBuilder = 
			buildUsersSubscriptionViewModel:sinon.stub().callsArgWith(1, null, @activeRecurlySubscription)
			buildViewModel: sinon.stub()
		@settings = 
			coupon_codes:
				upgradeToAnnualPromo: 
					student:"STUDENTCODEHERE"
					collaborator:"COLLABORATORCODEHERE"
			apis:
				recurly:
					subdomain:"sl.recurly.com"
			siteUrl: "http://de.sharelatex.dev:3000"

		@SubscriptionController = SandboxedModule.require modulePath, requires:
			'../../managers/SecurityManager': @SecurityManager
			'./SubscriptionHandler': @SubscriptionHandler
			"./PlansLocator": @PlansLocator
			'./SubscriptionViewModelBuilder': @SubscriptionViewModelBuilder
			"./LimitationsManager": @LimitationsManager
			'./RecurlyWrapper': @RecurlyWrapper
			"logger-sharelatex": log:->
			"settings-sharelatex": @settings


		@res = new MockResponse()
		@req = new MockRequest()
		@req.body = {}
		@req.query = 
			planCode:"123123"

	describe "editBillingDetailsPage", ->
		describe "with a user with a subscription", ->
			beforeEach (done) ->
				@LimitationsManager.userHasSubscription.callsArgWith(1, null, true)
				@user.id = @activeRecurlySubscription.account.account_code
				@res.callback = done
				@SubscriptionController.editBillingDetailsPage(@req, @res)

			it "should render the edit billing details page", ->
				@res.rendered.should.equal true
				@res.renderedTemplate.should.equal "subscriptions/edit-billing-details"

			it "should set the correct variables for the template", ->
				should.exist @res.renderedVariables.signature
				@res.renderedVariables.successURL.should.equal "#{@settings.siteUrl}/user/subscription/update"
				@res.renderedVariables.user.id.should.equal @user.id

		describe "with a user without subscription", ->
			beforeEach (done) ->
				@res.callback = done
				@LimitationsManager.userHasSubscription.callsArgWith(1, null, false)
				@SubscriptionController.reactivateSubscription @req, @res

			it "should redirect to the subscription dashboard", ->
				@res.redirected.should.equal true
				@res.redirectedTo.should.equal "/user/subscription"

	describe "paymentPage", ->
		describe "with a user without a subscription", ->
			beforeEach ->
				@LimitationsManager.userHasSubscription.callsArgWith(1, null, false)
				@PlansLocator.findLocalPlanInSettings.returns({})

			describe "with a valid plan code", ->

				it "should render the new subscription page", (done)->
					@res.render = (page, opts)=>
						page.should.equal "subscriptions/new"
						done()
					@SubscriptionController.paymentPage @req, @res

				it "should set the successURL", (done)->
					@req.session._csrf = @csrfToken = "mock-csrf-token"
					@res.render = (page, opts)=>
						url = JSON.parse(opts.subscriptionFormOptions).successURL
						url.should.equal("#{@settings.siteUrl}/user/subscription/create?_csrf=#{@csrfToken}")
						done()
					@SubscriptionController.paymentPage @req, @res

		describe "with a user with subscription", ->
			it "should redirect to the subscription dashboard", (done)->
				@LimitationsManager.userHasSubscription.callsArgWith(1, null, true)
				@res.redirect = (url)=>
					url.should.equal "/user/subscription"
					done()
				@SubscriptionController.paymentPage(@req, @res)

		describe "with an invalid plan code", ->
			it "should redirect to the subscription dashboard", (done)->
				@LimitationsManager.userHasSubscription.callsArgWith(1, null, false)
				@PlansLocator.findLocalPlanInSettings.returns(null)
				@res.redirect = (url)=>
					url.should.equal "/user/subscription"
					done()
				@SubscriptionController.paymentPage(@req, @res)

	describe "successful_subscription", ->
		beforeEach (done) ->
			@SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel.callsArgWith(1, null, {})
			@res.callback = done
			@SubscriptionController.successful_subscription @req, @res

	describe "userSubscriptionPage", ->
		describe "with a user without a subscription", ->
			beforeEach (done) ->
				@res.callback = done
				@LimitationsManager.userHasSubscriptionOrIsGroupMember.callsArgWith(1, null, false)
				@SubscriptionController.userSubscriptionPage @req, @res

			it "should redirect to the plans page", ->
				@res.redirected.should.equal true
				@res.redirectedTo.should.equal "/user/subscription/plans"

		describe "with a user with a paid subscription", ->
			beforeEach (done) ->
				@res.callback = done
				@SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel.callsArgWith(1, null, @activeRecurlySubscription)
				@LimitationsManager.userHasSubscriptionOrIsGroupMember.callsArgWith(1, null, true)
				@SubscriptionController.userSubscriptionPage @req, @res

			it "should render the dashboard", (done)->
				@res.rendered.should.equal true
				@res.renderedTemplate.should.equal "subscriptions/dashboard"
				done()
			
			it "should set the correct subscription details", ->
				@res.renderedVariables.subscription.should.deep.equal @activeRecurlySubscription

		describe "with a user with a free trial", ->
			beforeEach (done) ->
				@res.callback = done
				@SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel.callsArgWith(1, null, @activeRecurlySubscription)
				@LimitationsManager.userHasSubscriptionOrIsGroupMember.callsArgWith(1, null, true)
				@SubscriptionController.userSubscriptionPage @req, @res

			it "should render the dashboard", ->
				@res.renderedTemplate.should.equal "subscriptions/dashboard"
			
			it "should set the correct subscription details", ->
				@res.renderedVariables.subscription.should.deep.equal @activeRecurlySubscription


		describe "when its a custom subscription which is non recurly", ->
			beforeEach ()->
				@LimitationsManager.userHasSubscriptionOrIsGroupMember.callsArgWith(1, null, true, {customAccount:true})
				@SubscriptionController.userSubscriptionPage @req, @res

			it "should redirect to /user/subscription/custom_account", ->
				@res.redirectedTo.should.equal("/user/subscription/custom_account")



	describe "createSubscription", ->
		beforeEach (done)->
			@res =
				redirect:->
					done()
			sinon.spy @res, "redirect"
			@req.body.recurly_token = "1234"
			@SubscriptionController.createSubscription @req, @res

		it "should send the user and subscriptionId to the handler", (done)->
			@SubscriptionHandler.createSubscription.calledWith(@user, @req.body.recurly_token).should.equal true
			done()

		it "should redurect to the subscription page", (done)->
			@res.redirect.calledWith("/user/subscription/thank-you").should.equal true
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
				@res = send:->
					done()
				sinon.spy @res, "send"
				@SubscriptionController.recurlyCallback @req, @res

			it "should tell the SubscriptionHandler to process the recurly callback", (done)->
				@SubscriptionHandler.recurlyCallback.called.should.equal true
				done()


			it "should send a 200", (done)->
				@res.send.calledWith(200)
				done()

		describe "with a non-actionable request", ->
			beforeEach (done) ->
				@user.id = @activeRecurlySubscription.account.account_code
				@req =
					body:
						new_subscription_notification:
							subscription:
								uuid: @activeRecurlySubscription.uuid
				@res = send:->
					done()
				sinon.spy @res, "send"
				@SubscriptionController.recurlyCallback @req, @res

			it "should not call the subscriptionshandler", ->
				@SubscriptionHandler.recurlyCallback.called.should.equal false

			it "should respond with a 200 status", ->
				@res.send.calledWith(200)


	describe "renderUpgradeToAnnualPlanPage", ->


		it "should redirect to the plans page if the user does not have a subscription", (done)->
			@LimitationsManager.userHasSubscription.callsArgWith(1, null, false)
			@res.redirect = (url)->
				url.should.equal "/user/subscription/plans"
				done()
			@SubscriptionController.renderUpgradeToAnnualPlanPage @req, @res


		it "should pass the plan code to the view - student", (done)->

			@LimitationsManager.userHasSubscription.callsArgWith(1, null, true, {planCode:"Student free trial 14 days"})
			@res.render = (view, opts)->
				view.should.equal "subscriptions/upgradeToAnnual"
				opts.planName.should.equal "student"
				done()
			@SubscriptionController.renderUpgradeToAnnualPlanPage @req, @res

		it "should pass the plan code to the view - collaborator", (done)->

			@LimitationsManager.userHasSubscription.callsArgWith(1, null, true, {planCode:"free trial for Collaborator free trial 14 days"})
			@res.render = (view, opts)->
				opts.planName.should.equal "collaborator"
				done()
			@SubscriptionController.renderUpgradeToAnnualPlanPage @req, @res

		it "should pass annual as the plan name if the user is already on an annual plan", (done)->

			@LimitationsManager.userHasSubscription.callsArgWith(1, null, true, {planCode:"student annual with free trial"})
			@res.render = (view, opts)->
				opts.planName.should.equal "annual"
				done()
			@SubscriptionController.renderUpgradeToAnnualPlanPage @req, @res


	describe "processUpgradeToAnnualPlan", ->

		beforeEach ->
			
		it "should tell the subscription handler to update the subscription with the annual plan and apply a coupon code", (done)->
			@req.body =
				planName:"student"

			@res.send = ()=>
				@SubscriptionHandler.updateSubscription.calledWith(@user, "student-annual", "STUDENTCODEHERE").should.equal true
				done()

			@SubscriptionController.processUpgradeToAnnualPlan @req, @res

		it "should get the collaborator coupon code", (done)->

			@req.body =
				planName:"collaborator"

			@res.send = (url)=>
				@SubscriptionHandler.updateSubscription.calledWith(@user, "collaborator-annual", "COLLABORATORCODEHERE").should.equal true
				done()

			@SubscriptionController.processUpgradeToAnnualPlan @req, @res



