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
			_id:"kwjewkl"
			features:{}

		@UserLocator =
			findById: sinon.stub().callsArgWith(1, null, @user)
		@dropboxStatus = {}
		@DropboxHandler =
			getUserRegistrationStatus : sinon.stub().callsArgWith(1, null, @dropboxStatus)
		@UserPagesController = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": log:->
			"./UserLocator": @UserLocator
			'../Dropbox/DropboxHandler': @DropboxHandler
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

	describe "passwordResetPage", ->

		it "should render the login page", (done)->
			@res.render = (page)=>
				page.should.equal "user/passwordReset"
				done()
			@UserPagesController.passwordResetPage @req, @res


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