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
			softDeleteUsersProjects: sinon.stub().callsArgWith(1)

		@SubscriptionHandler = 
			cancelSubscription: sinon.stub().callsArgWith(1)

		@deleteAffiliations = sinon.stub().callsArgWith(1)

		@mongojs =
			db:
				deletedUsers:
					insert: sinon.stub().callsArg(1)

		@UserDeleter = SandboxedModule.require modulePath, requires:
			"../../models/User": User: @User
			"../Newsletter/NewsletterManager":  @NewsletterManager
			"../Subscription/SubscriptionHandler": @SubscriptionHandler
			"../Project/ProjectDeleter": @ProjectDeleter
			"../Institutions/InstitutionsAPI":
				deleteAffiliations: @deleteAffiliations
			"../../infrastructure/mongojs": @mongojs
			"logger-sharelatex": @logger = { log: sinon.stub() }

	describe "softDeleteUser", ->

		it "should delete the user in mongo", (done)->
			@UserDeleter.softDeleteUser @user._id, (err)=>
				@User.findById.calledWith(@user._id).should.equal true
				@user.remove.called.should.equal true
				done()

		it "should add the user to the deletedUsers collection", (done)->
			@UserDeleter.softDeleteUser @user._id, (err)=>
				sinon.assert.calledWith(@mongojs.db.deletedUsers.insert, @user)
				done()

		it "should set the deletedAt field on the user", (done)->
			@UserDeleter.softDeleteUser @user._id, (err)=>
				@user.deletedAt.should.exist
				done()

		it "should unsubscribe the user from the news letter", (done)->
			@UserDeleter.softDeleteUser @user._id, (err)=>
				@NewsletterManager.unsubscribe.calledWith(@user).should.equal true
				done()

		it "should unsubscribe the user", (done)->
			@UserDeleter.softDeleteUser @user._id, (err)=>
				@SubscriptionHandler.cancelSubscription.calledWith(@user).should.equal true
				done()

		it "should delete user affiliations", (done)->
			@UserDeleter.softDeleteUser @user._id, (err)=>
				@deleteAffiliations.calledWith(@user._id).should.equal true
				done()

		it "should soft-delete all the projects of a user", (done)->
			@UserDeleter.softDeleteUser @user._id, (err)=>
				@ProjectDeleter.softDeleteUsersProjects.calledWith(@user._id).should.equal true
				done()

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

		it "should delete user affiliations", (done)->
			@UserDeleter.deleteUser @user._id, (err)=>
				@deleteAffiliations.calledWith(@user._id).should.equal true
				done()
