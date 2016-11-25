should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/User/UserPagesController"
expect = require("chai").expect

describe "UserPagesController", ->

	beforeEach ->

		@settings = {}
		@user =
			_id: @user_id = "kwjewkl"
			features:{}
			email: "joe@example.com"

		@UserLocator =
			findById: sinon.stub().callsArgWith(1, null, @user)
		@UserGetter =
			getUser: sinon.stub().callsArgWith(2, null, @user)
		@UserSessionsManager =
			getAllUserSessions: sinon.stub()
		@dropboxStatus = {}
		@DropboxHandler =
			getUserRegistrationStatus : sinon.stub().callsArgWith(1, null, @dropboxStatus)
		@ErrorController =
			notFound: sinon.stub()
		@AuthenticationController =
			getLoggedInUserId: sinon.stub().returns(@user._id)
			getSessionUser: sinon.stub().returns(@user)
		@UserPagesController = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @settings
			"logger-sharelatex":
				log:->
				err:->
			"./UserLocator": @UserLocator
			"./UserGetter": @UserGetter
			"./UserSessionsManager": @UserSessionsManager
			"../Errors/ErrorController": @ErrorController
			'../Dropbox/DropboxHandler': @DropboxHandler
			'../Authentication/AuthenticationController': @AuthenticationController
		@req =
			query:{}
			session:
					user:@user
		@res = {}


	describe "registerPage", ->

		it "should render the register page", (done)->
			@res.render = (page)=>
				page.should.equal "user/register"
				done()
			@UserPagesController.registerPage @req, @res

		it "should set the redirect", (done)->
			redirect = "/go/here/please"
			@req.query.redir = redirect
			@res.render = (page, opts)=>
				opts.redir.should.equal redirect
				done()
			@UserPagesController.registerPage @req, @res

		it "should set sharedProjectData", (done)->
			@req.query.project_name = "myProject"
			@req.query.user_first_name = "user_first_name_here"

			@res.render = (page, opts)=>
				opts.sharedProjectData.project_name.should.equal "myProject"
				opts.sharedProjectData.user_first_name.should.equal "user_first_name_here"
				done()
			@UserPagesController.registerPage @req, @res

		it "should set newTemplateData", (done)->
			@req.session.templateData =
				templateName : "templateName"

			@res.render = (page, opts)=>
				opts.newTemplateData.templateName.should.equal "templateName"
				done()
			@UserPagesController.registerPage @req, @res

		it "should not set the newTemplateData if there is nothing in the session", (done)->
			@res.render = (page, opts)=>
				assert.equal opts.newTemplateData.templateName, undefined
				done()
			@UserPagesController.registerPage @req, @res


	describe "loginForm", ->

		it "should render the login page", (done)->
			@res.render = (page)=>
				page.should.equal "user/login"
				done()
			@UserPagesController.loginPage @req, @res

		it "should set the redirect", (done)->
			redirect = "/go/here/please"
			@req.query.redir = redirect
			@res.render = (page, opts)=>
				opts.redir.should.equal redirect
				done()
			@UserPagesController.loginPage @req, @res

	describe 'sessionsPage', ->

		beforeEach ->
			@UserSessionsManager.getAllUserSessions.callsArgWith(2, null, [])

		it 'should render user/sessions', (done) ->
			@res.render = (page)->
				page.should.equal "user/sessions"
				done()
			@UserPagesController.sessionsPage @req, @res

		it 'should have called getAllUserSessions', (done) ->
			@res.render = (page) =>
				@UserSessionsManager.getAllUserSessions.callCount.should.equal 1
				done()
			@UserPagesController.sessionsPage @req, @res

		describe 'when getAllUserSessions produces an error', ->

			beforeEach ->
				@UserSessionsManager.getAllUserSessions.callsArgWith(2, new Error('woops'))

			it 'should call next with an error', (done) ->
				@next = (err) =>
					assert(err != null)
					assert(err instanceof Error)
					done()
				@UserPagesController.sessionsPage @req, @res, @next

	describe "settingsPage", ->

		it "should render user/settings", (done)->
			@res.render = (page)->
				page.should.equal "user/settings"
				done()
			@UserPagesController.settingsPage @req, @res

		it "should send user", (done)->
			@res.render = (page, opts)=>
				opts.user.should.equal @user
				done()
			@UserPagesController.settingsPage @req, @res

		it "should set 'shouldAllowEditingDetails' to true", (done)->
			@res.render = (page, opts)=>
				opts.shouldAllowEditingDetails.should.equal true
				done()
			@UserPagesController.settingsPage @req, @res

		describe 'when ldap.updateUserDetailsOnLogin is true', ->

			beforeEach ->
				@settings.ldap = {updateUserDetailsOnLogin: true}

			afterEach ->
				delete @settings.ldap

			it 'should set "shouldAllowEditingDetails" to false', (done) ->
				@res.render = (page, opts)=>
					opts.shouldAllowEditingDetails.should.equal false
					done()
				@UserPagesController.settingsPage @req, @res

		describe 'when saml.updateUserDetailsOnLogin is true', ->

			beforeEach ->
				@settings.saml = {updateUserDetailsOnLogin: true}

			afterEach ->
				delete @settings.saml

			it 'should set "shouldAllowEditingDetails" to false', (done) ->
				@res.render = (page, opts)=>
					opts.shouldAllowEditingDetails.should.equal false
					done()
				@UserPagesController.settingsPage @req, @res

	describe "activateAccountPage", ->
		beforeEach ->
			@req.query.user_id = @user_id
			@req.query.token = @token = "mock-token-123"

		it "should 404 without a user_id", (done) ->
			delete @req.query.user_id
			@ErrorController.notFound = () ->
				done()
			@UserPagesController.activateAccountPage @req, @res

		it "should 404 without a token", (done) ->
			delete @req.query.token
			@ErrorController.notFound = () ->
				done()
			@UserPagesController.activateAccountPage @req, @res

		it "should 404 without a valid user_id", (done) ->
			@UserGetter.getUser = sinon.stub().callsArgWith(2, null, null)
			@ErrorController.notFound = () ->
				done()
			@UserPagesController.activateAccountPage @req, @res

		it "should redirect activated users to login", (done) ->
			@user.loginCount = 1
			@res.redirect = (url) =>
				@UserGetter.getUser.calledWith(@user_id).should.equal true
				url.should.equal "/login?email=#{encodeURIComponent(@user.email)}"
				done()
			@UserPagesController.activateAccountPage @req, @res

		it "render the activation page if the user has not logged in before", (done) ->
			@user.loginCount = 0
			@res.render = (page, opts) =>
				page.should.equal "user/activate"
				opts.email.should.equal @user.email
				opts.token.should.equal @token
				done()
			@UserPagesController.activateAccountPage @req, @res
