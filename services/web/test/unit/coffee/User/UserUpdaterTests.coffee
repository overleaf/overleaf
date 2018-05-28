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
		@UserGetter =
			getUserEmail: sinon.stub()
			getUserByAnyEmail: sinon.stub()
			ensureUniqueEmailAddress: sinon.stub()
		@logger = err: sinon.stub(), log: ->
		@UserUpdater = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": @logger
			"./UserGetter": @UserGetter
			"../../infrastructure/mongojs":@mongojs
			"metrics-sharelatex": timeAsyncMethod: sinon.stub()

		@stubbedUser = 
			_id: "3131231"
			name:"bob"
			email:"hello@world.com"
		@newEmail = "bob@bob.com"

	describe 'changeEmailAddress', ->
		beforeEach ->
			@UserGetter.getUserEmail.callsArgWith(1, null, @stubbedUser.email)
			@UserUpdater.addEmailAddress = sinon.stub().callsArgWith(2)
			@UserUpdater.setDefaultEmailAddress = sinon.stub().callsArgWith(2)
			@UserUpdater.removeEmailAddress = sinon.stub().callsArgWith(2)

		it 'change email', (done)->
			@UserUpdater.changeEmailAddress @stubbedUser._id, @newEmail, (err)=>
				should.not.exist(err)
				@UserUpdater.addEmailAddress.calledWith(
					@stubbedUser._id, @newEmail
				).should.equal true
				@UserUpdater.setDefaultEmailAddress.calledWith(
					@stubbedUser._id, @newEmail
				).should.equal true
				@UserUpdater.removeEmailAddress.calledWith(
					@stubbedUser._id, @stubbedUser.email
				).should.equal true
				done()

		it 'handle error', (done)->
			@UserUpdater.removeEmailAddress.callsArgWith(2, new Error('nope'))
			@UserUpdater.changeEmailAddress @stubbedUser._id, @newEmail, (err)=>
				should.exist(err)
				done()

	describe 'addEmailAddress', ->
		beforeEach ->
			@UserGetter.ensureUniqueEmailAddress = sinon.stub().callsArgWith(1)

		it 'add email', (done)->
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2, null)

			@UserUpdater.addEmailAddress @stubbedUser._id, @newEmail, (err)=>
				@UserGetter.ensureUniqueEmailAddress.called.should.equal true
				should.not.exist(err)
				@UserUpdater.updateUser.calledWith(
					@stubbedUser._id,
					$push: { emails: { email: @newEmail, createdAt: sinon.match.date } }
				).should.equal true
				done()

		it 'handle error', (done)->
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2, new Error('nope'))

			@UserUpdater.addEmailAddress @stubbedUser._id, @newEmail, (err)=>
				@logger.err.called.should.equal true
				should.exist(err)
				done()

	describe 'removeEmailAddress', ->
		it 'remove email', (done)->
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2, null, nMatched: 1)

			@UserUpdater.removeEmailAddress @stubbedUser._id, @newEmail, (err)=>
				should.not.exist(err)
				@UserUpdater.updateUser.calledWith(
					{ _id: @stubbedUser._id, email: { $ne: @newEmail } },
					$pull: { emails: { email: @newEmail } }
				).should.equal true
				done()

		it 'handle error', (done)->
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2, new Error('nope'))

			@UserUpdater.removeEmailAddress @stubbedUser._id, @newEmail, (err)=>
				should.exist(err)
				done()

		it 'handle missed update', (done)->
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2, null, nMatched: 0)

			@UserUpdater.removeEmailAddress @stubbedUser._id, @newEmail, (err)=>
				should.exist(err)
				done()

	describe 'setDefaultEmailAddress', ->
		it 'set default', (done)->
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2, null, nMatched: 1)

			@UserUpdater.setDefaultEmailAddress @stubbedUser._id, @newEmail, (err)=>
				should.not.exist(err)
				@UserUpdater.updateUser.calledWith(
					{ _id: @stubbedUser._id, 'emails.email': @newEmail },
					$set: { email: @newEmail }
				).should.equal true
				done()

		it 'handle error', (done)->
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2, new Error('nope'))

			@UserUpdater.setDefaultEmailAddress @stubbedUser._id, @newEmail, (err)=>
				should.exist(err)
				done()

		it 'handle missed update', (done)->
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2, null, nMatched: 0)

			@UserUpdater.setDefaultEmailAddress @stubbedUser._id, @newEmail, (err)=>
				should.exist(err)
				done()


