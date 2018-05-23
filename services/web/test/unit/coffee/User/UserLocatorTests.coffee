sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/Features/User/UserLocator.js"
SandboxedModule = require('sandboxed-module')

describe "UserLocator", ->

	beforeEach ->
		@fakeUser = {_id:"12390i"}
		@findOne = sinon.stub().callsArgWith(1, null, @fakeUser)
		@Mongo =
			db: users: findOne: @findOne
			ObjectId: (id) -> return id

		@UserLocator = SandboxedModule.require modulePath, requires:
			"../../infrastructure/mongojs": @Mongo
			"metrics-sharelatex": timeAsyncMethod: sinon.stub()
			'logger-sharelatex' : { log: sinon.stub() }

	describe "findById", ->
		it "should try and find a user with that id", (done)->
			_id = '123e'
			@UserLocator.findById _id, (err, user)=>
				@findOne.calledWith(_id: _id).should.equal true
				done()

		it "should return the user if found", (done)->
			@UserLocator.findById '123e', (err, user)=>
				user.should.deep.equal @fakeUser
				done()
