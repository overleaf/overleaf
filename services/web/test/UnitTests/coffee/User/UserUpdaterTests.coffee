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

	describe "updatePersonalInfo", ->

		beforeEach ->
			@info =
				first_name:"billy"
				last_name:"brag"
				role:"student"
				institution:"sheffield"

		it "should set the names role and institution", (done)->
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2)
			@UserUpdater.updatePersonalInfo @user_id, @info, (err)=>
				@UserUpdater.updateUser.args[0][0].should.equal @user_id
				args = @UserUpdater.updateUser.args[0][1]
				args["$set"].first_name.should.equal @info.first_name
				args["$set"].last_name.should.equal @info.last_name
				args["$set"].role.should.equal @info.role
				args["$set"].institution.should.equal @info.institution
				done()

		it "should return the error", (done)->
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2, "error")
			@UserUpdater.updatePersonalInfo @user_id, @info, (err)=>
				should.exist(err)
				done()

		it "should default them to empty strings", (done)->
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2)
			@UserUpdater.updatePersonalInfo @user_id, {}, (err)=>
				args = @UserUpdater.updateUser.args[0][1]
				args["$set"].first_name.should.equal ""
				args["$set"].last_name.should.equal ""
				args["$set"].role.should.equal ""
				args["$set"].institution.should.equal ""
				done()

