sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/Features/User/UserLocator.js"
SandboxedModule = require('sandboxed-module')

describe "UserLocator", ->

	beforeEach ->
		@user = {_id:"12390i"}
		@UserLocator = SandboxedModule.require modulePath, requires:
			"../../infrastructure/mongojs": db: @db =  { users: {} }
		@db.users =
			findOne : sinon.stub().callsArgWith(1, null, @user)

		@email = "bob.oswald@gmail.com"


	describe "findByEmail", ->

		it "should try and find a user with that email address", (done)->
			@UserLocator.findByEmail @email, (err, user)=>
				@db.users.findOne.calledWith(email:@email).should.equal true
				done()

		it "should trim white space", (done)->
			@UserLocator.findByEmail "#{@email}   ", (err, user)=>
				@db.users.findOne.calledWith(email:@email).should.equal true
				done()

		it "should return the user if found", (done)->
			@UserLocator.findByEmail @email, (err, user)=>
				user.should.deep.equal @user
				done()



