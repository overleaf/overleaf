sinon = require('sinon')
chai = require('chai')
assert = require("assert")
should = chai.should()
modulePath = "../../../../app/js/Features/User/UserCreator.js"
SandboxedModule = require('sandboxed-module')

describe "UserCreator", ->

	beforeEach ->
		self = @
		@user = {_id:"12390i"}
		@user.save = sinon.stub().callsArgWith(0)
		@UserModel = class Project
			constructor: ->
				return self.user

		@UserLocator = 
			findByEmail: sinon.stub()
		@UserCreator = SandboxedModule.require modulePath, requires:
			"../../models/User": User:@UserModel
			"./UserLocator":@UserLocator

		@email = "bob.oswald@gmail.com"


	describe "getUserOrCreateHoldingAccount", ->

		it "should immediately return the user if found", (done)->
			@UserLocator.findByEmail.callsArgWith(1, null, @user)
			@UserCreator.getUserOrCreateHoldingAccount @email, (err, returnedUser)=>
				assert.deepEqual returnedUser, @user
				done()

		it "should create new holding account if the user is not found", (done)->
			@UserLocator.findByEmail.callsArgWith(1)
			@UserCreator.createNewUser = sinon.stub().callsArgWith(1, null, @user)
			@UserCreator.getUserOrCreateHoldingAccount @email, (err, returnedUser)=>
				@UserCreator.createNewUser.calledWith(email:@email, holdingAccount:true).should.equal true
				assert.deepEqual returnedUser, @user
				done()


	describe "createNewUser", ->

		it "should take the opts and put them in the model", (done)->
			opts =
				email:@email
				holdingAccount:true
			@UserCreator.createNewUser opts, (err, user)=>
				assert.equal user.email, @email
				assert.equal user.holdingAccount, true

				done()



