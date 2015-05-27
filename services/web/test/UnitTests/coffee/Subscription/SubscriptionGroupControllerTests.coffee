SandboxedModule = require('sandboxed-module')
should = require('chai').should()
sinon = require 'sinon'
assert = require("chai").assert
modulePath = "../../../../app/js/Features/Subscription/SubscriptionGroupController"


describe "Subscription Group Controller", ->

	beforeEach ->
		@user = {_id:"!@312431"}
		@subscription = {}
		@GroupHandler = 
			addUserToGroup: sinon.stub().callsArgWith(2, null, @user)
			removeUserFromGroup: sinon.stub().callsArgWith(2)
			isUserPartOfGroup: sinon.stub()
			sendVerificationEmail:sinon.stub()
			processGroupVerification:sinon.stub()

		@SubscriptionLocator = getUsersSubscription: sinon.stub().callsArgWith(1, null, @subscription)

		@SubscriptionDomainHandler = 
			findDomainLicenceBySubscriptionId:sinon.stub()

		@OneTimeTokenHandler =
			getValueFromTokenAndExpire:sinon.stub()


		@ErrorsController = 
			notFound:sinon.stub()

		@Controller = SandboxedModule.require modulePath, requires:
			"./SubscriptionGroupHandler":@GroupHandler
			"logger-sharelatex": log:->
			"./SubscriptionLocator": @SubscriptionLocator
			"./SubscriptionDomainHandler":@SubscriptionDomainHandler
			"../Errors/ErrorController":@ErrorsController

		@adminUserId = "123jlkj"
		@subscription_id = "123434325412"
		@user_email = "bob@gmail.com"
		@req =
			session:
				user: 
					_id: @adminUserId
					email:@user_email
			params:
				subscription_id:@subscription_id
			query:{}

		@token = "super-secret-token"


	describe "addUserToGroup", ->

		it "should use the admin id for the logged in user and take the email address from the body", (done)->
			newEmail = "31231"
			@req.body = email: newEmail
			res =
				json : (data)=>
					@GroupHandler.addUserToGroup.calledWith(@adminUserId, newEmail).should.equal true
					data.user.should.deep.equal @user
					done()
			@Controller.addUserToGroup @req, res


	describe "removeUserFromGroup", ->
		it "should use the admin id for the logged in user and take the email address from the body", (done)->
			userIdToRemove = "31231"
			@req.params = user_id: userIdToRemove

			res =
				send : =>
					@GroupHandler.removeUserFromGroup.calledWith(@adminUserId, userIdToRemove).should.equal true
					done()
			@Controller.removeUserFromGroup @req, res


	describe "renderSubscriptionGroupAdminPage", ->	
		it "should redirect you if you don't have a group account", (done)->
			@subscription.group = false

			res =
				redirect : (path)=>
					path.should.equal("/")
					done()
			@Controller.renderSubscriptionGroupAdminPage @req, res


	describe "renderGroupInvitePage", ->
		describe "with a valid licence", ->
			beforeEach ->
				@SubscriptionDomainHandler.findDomainLicenceBySubscriptionId.returns({subscription_id:@subscription_id, adminUser_id:@adminUserId})

			it "should render subscriptions/group/invite if not part of group", (done)->
				@GroupHandler.isUserPartOfGroup.callsArgWith(2, null, false)
				res =
					render : (pageName)=>
						pageName.should.equal "subscriptions/group/invite"
						done()
				@Controller.renderGroupInvitePage @req, res

			it "should redirect to custom page if is already part of group", (done)->
				@GroupHandler.isUserPartOfGroup.callsArgWith(2, null, true)
				res =
					redirect : (location)=>
						location.should.equal "/user/subscription/custom_account"
						done()
				@Controller.renderGroupInvitePage @req, res

		describe "without a valid licence", ->
			beforeEach ->
				@SubscriptionDomainHandler.findDomainLicenceBySubscriptionId.returns(undefined)

			it "should send a 500", (done)->
				@Controller.renderGroupInvitePage @req, {}
				@ErrorsController.notFound.called.should.equal true
				done()



	describe "beginJoinGroup", ->
		describe "with a valid licence", ->
			beforeEach ->
				@licenceName = "get amazing licence"
				@SubscriptionDomainHandler.findDomainLicenceBySubscriptionId.returns({name:@licenceName})
				@GroupHandler.sendVerificationEmail.callsArgWith(3)

			it "should ask the SubscriptionGroupHandler to send the verification email", (done)->
				res =
					send : (statusCode)=>
						statusCode.should.equal 200
						@GroupHandler.sendVerificationEmail.calledWith(@subscription_id, @licenceName, @user_email).should.equal true
						done()
				@Controller.beginJoinGroup @req, res

		describe "without a valid licence", ->
			beforeEach ->
				@SubscriptionDomainHandler.findDomainLicenceBySubscriptionId.returns(undefined)

			it "should send a 500", (done)->
				@Controller.beginJoinGroup @req, {}
				@ErrorsController.notFound.called.should.equal true
				done()


	describe "completeJoin", ->
		describe "with a valid licence", ->
			beforeEach ->
				@GroupHandler.processGroupVerification.callsArgWith(3)
				@SubscriptionDomainHandler.findDomainLicenceBySubscriptionId.returns({name:@licenceName})

			it "should redirect to the success page upon processGroupVerification", (done)->
				@req.query.token = @token
				res =
					redirect : (location)=>
						@GroupHandler.processGroupVerification.calledWith(@user_email, @subscription_id, @token).should.equal true
						location.should.equal "/user/subscription/#{@subscription_id}/group/successful-join"
						done()
				@Controller.completeJoin @req, res

		describe "without a valid licence", ->
			beforeEach ->
				@SubscriptionDomainHandler.findDomainLicenceBySubscriptionId.returns(undefined)

			it "should send a 500", (done)->
				@Controller.completeJoin @req, {}
				@ErrorsController.notFound.called.should.equal true
				done()