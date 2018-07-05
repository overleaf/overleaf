should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/User/UserUpdater"
expect = require("chai").expect
tk = require('timekeeper')

describe "UserUpdater", ->

	beforeEach ->
		tk.freeze(Date.now())
		@mongojs = 
			db:{}
			ObjectId:(id)-> return id
		@UserGetter =
			getUserEmail: sinon.stub()
			getUserByAnyEmail: sinon.stub()
			ensureUniqueEmailAddress: sinon.stub()
		@logger = err: sinon.stub(), log: ->
		@addAffiliation = sinon.stub().callsArgWith(3, null)
		@removeAffiliation = sinon.stub().callsArgWith(2, null)
		@UserUpdater = SandboxedModule.require modulePath, requires:
			"logger-sharelatex": @logger
			"./UserGetter": @UserGetter
			'./UserAffiliationsManager':
				addAffiliation: @addAffiliation
				removeAffiliation: @removeAffiliation
			"../../infrastructure/mongojs":@mongojs
			"metrics-sharelatex": timeAsyncMethod: sinon.stub()

		@stubbedUser = 
			_id: "3131231"
			name:"bob"
			email:"hello@world.com"
		@newEmail = "bob@bob.com"

	afterEach ->
		tk.reset()

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

		it 'validates email', (done)->
			@UserUpdater.changeEmailAddress @stubbedUser._id, 'foo', (err)=>
				should.exist(err)
				done()

		it 'handle error', (done)->
			@UserUpdater.removeEmailAddress.callsArgWith(2, new Error('nope'))
			@UserUpdater.changeEmailAddress @stubbedUser._id, @newEmail, (err)=>
				should.exist(err)
				done()

	describe 'addEmailAddress', ->
		beforeEach ->
			@UserGetter.ensureUniqueEmailAddress = sinon.stub().callsArgWith(1)
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2, null)

		it 'add email', (done)->
			@UserUpdater.addEmailAddress @stubbedUser._id, @newEmail, (err)=>
				@UserGetter.ensureUniqueEmailAddress.called.should.equal true
				should.not.exist(err)
				@UserUpdater.updateUser.calledWith(
					@stubbedUser._id,
					$push: { emails: { email: @newEmail, createdAt: sinon.match.date } }
				).should.equal true
				done()

		it 'add affiliation', (done)->
			affiliationOptions =
				university: { id: 1 }
				role: 'Prof'
				department: 'Math'
			@UserUpdater.addEmailAddress @stubbedUser._id, @newEmail, affiliationOptions, (err)=>
				should.not.exist(err)
				@addAffiliation.calledOnce.should.equal true
				args = @addAffiliation.lastCall.args
				args[0].should.equal @stubbedUser._id
				args[1].should.equal @newEmail
				args[2].should.equal affiliationOptions
				done()

		it 'handle error', (done)->
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2, new Error('nope'))

			@UserUpdater.addEmailAddress @stubbedUser._id, @newEmail, (err)=>
				@logger.err.called.should.equal true
				should.exist(err)
				done()

		it 'handle affiliation error', (done)->
			body = errors: 'affiliation error message'
			@addAffiliation.callsArgWith(3, new Error('nope'))
			@UserUpdater.addEmailAddress @stubbedUser._id, @newEmail, (err)=>
				should.exist(err)
				@UserUpdater.updateUser.called.should.equal false
				done()

		it 'validates email', (done)->
			@UserUpdater.addEmailAddress @stubbedUser._id, 'bar', (err)=>
				should.exist(err)
				done()

	describe 'removeEmailAddress', ->
		beforeEach ->
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2, null, nMatched: 1)

		it 'remove email', (done)->
			@UserUpdater.removeEmailAddress @stubbedUser._id, @newEmail, (err)=>
				should.not.exist(err)
				@UserUpdater.updateUser.calledWith(
					{ _id: @stubbedUser._id, email: { $ne: @newEmail } },
					$pull: { emails: { email: @newEmail } }
				).should.equal true
				done()

		it 'remove affiliation', (done)->
			@UserUpdater.removeEmailAddress @stubbedUser._id, @newEmail, (err)=>
				should.not.exist(err)
				@removeAffiliation.calledOnce.should.equal true
				args = @removeAffiliation.lastCall.args
				args[0].should.equal @stubbedUser._id
				args[1].should.equal @newEmail
				done()

		it 'handle error', (done)->
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2, new Error('nope'))

			@UserUpdater.removeEmailAddress @stubbedUser._id, @newEmail, (err)=>
				should.exist(err)
				done()

		it 'handle missed update', (done)->
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2, null, n: 0)

			@UserUpdater.removeEmailAddress @stubbedUser._id, @newEmail, (err)=>
				should.exist(err)
				done()

		it 'handle affiliation error', (done)->
			@removeAffiliation.callsArgWith(2, new Error('nope'))
			@UserUpdater.removeEmailAddress @stubbedUser._id, @newEmail, (err)=>
				should.exist(err)
				@UserUpdater.updateUser.called.should.equal false
				done()

		it 'validates email', (done)->
			@UserUpdater.removeEmailAddress @stubbedUser._id, 'baz', (err)=>
				should.exist(err)
				done()

	describe 'setDefaultEmailAddress', ->
		it 'set default', (done)->
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2, null, n: 1)

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
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2, null, n: 0)

			@UserUpdater.setDefaultEmailAddress @stubbedUser._id, @newEmail, (err)=>
				should.exist(err)
				done()

		it 'validates email', (done)->
			@UserUpdater.setDefaultEmailAddress @stubbedUser._id, '.edu', (err)=>
				should.exist(err)
				done()

	describe 'confirmEmail', ->
		it 'should update the email record', (done)->
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2, null, n: 1)

			@UserUpdater.confirmEmail @stubbedUser._id, @newEmail, (err)=>
				should.not.exist(err)
				@UserUpdater.updateUser.calledWith(
					{ _id: @stubbedUser._id, 'emails.email': @newEmail },
					$set: { 'emails.$.confirmedAt': new Date() }
				).should.equal true
				done()

		it 'handle error', (done)->
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2, new Error('nope'))

			@UserUpdater.confirmEmail @stubbedUser._id, @newEmail, (err)=>
				should.exist(err)
				done()

		it 'handle missed update', (done)->
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2, null, n: 0)

			@UserUpdater.confirmEmail @stubbedUser._id, @newEmail, (err)=>
				should.exist(err)
				done()

		it 'validates email', (done)->
			@UserUpdater.confirmEmail @stubbedUser._id, '@', (err)=>
				should.exist(err)
				done()
