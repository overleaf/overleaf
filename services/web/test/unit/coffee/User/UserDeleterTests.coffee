sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/Features/User/UserDeleter.js"
SandboxedModule = require('sandboxed-module')

describe "UserDeleter", ->

	beforeEach ->
		@user = 
			_id:"12390i"
			email: "bob@bob.com"
			remove: sinon.stub().callsArgWith(0)

		@User =
			findById : sinon.stub().callsArgWith(1, null, @user)

		@NewsletterManager = 
			unsubscribe: sinon.stub().callsArgWith(1)

		@ProjectDeleter =
			deleteUsersProjects: sinon.stub().callsArgWith(1)

		@SubscriptionHandler = 
			cancelSubscription: sinon.stub().callsArgWith(1)
		@UserDeleter = SandboxedModule.require modulePath, requires:
			"../../models/User": User: @User
			"../Newsletter/NewsletterManager":  @NewsletterManager
			"../Subscription/SubscriptionHandler": @SubscriptionHandler
			"../Project/ProjectDeleter": @ProjectDeleter
			"logger-sharelatex": @logger = { log: sinon.stub() }

	describe "deleteUser", ->

		it "should delete the user in mongo", (done)->
			@UserDeleter.deleteUser @user._id, (err)=>
				@User.findById.calledWith(@user._id).should.equal true
				@user.remove.called.should.equal true
				done()

		it "should unsubscribe the user from the news letter", (done)->
			@UserDeleter.deleteUser @user._id, (err)=>
				@NewsletterManager.unsubscribe.calledWith(@user).should.equal true
				done()

		it "should delete all the projects of a user", (done)->
			@UserDeleter.deleteUser @user._id, (err)=>
				@ProjectDeleter.deleteUsersProjects.calledWith(@user._id).should.equal true
				done()

		it "should unsubscribe the user", (done)->
			@UserDeleter.deleteUser @user._id, (err)=>
				@SubscriptionHandler.cancelSubscription.calledWith(@user).should.equal true
				done()
