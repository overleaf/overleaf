should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/User/UserUpdater"
expect = require("chai").expect

describe "UserUpdater", ->

	beforeEach ->

		@settings = {}
		@mongojs = 
			db:{}
			ObjectId:(id)-> return id
		@UserLocator =
			findByEmail:sinon.stub()
		@UserUpdater = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": log:->
			"./UserLocator":@UserLocator
			"../../infrastructure/mongojs":@mongojs

		@stubbedUser = 
			name:"bob"
			email:"hello@world.com"
		@user_id = "3131231"
		@newEmail = "bob@bob.com"

	describe "changeEmailAddress", ->
		beforeEach ->
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2)

		it "should check if the new email already has an account", (done)->
			@UserLocator.findByEmail.callsArgWith(1, null, @stubbedUser)
			@UserUpdater.changeEmailAddress @user_id, @stubbedUser.email, (err)=>
				@UserUpdater.updateUser.called.should.equal false
				should.exist(err)
				done()


		it "should set the users password", (done)->
			@UserLocator.findByEmail.callsArgWith(1, null)
			@UserUpdater.changeEmailAddress @user_id, @newEmail, (err)=>
				@UserUpdater.updateUser.calledWith(@user_id, $set: { "email": @newEmail}).should.equal true
				done()
