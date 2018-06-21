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
		settings = apis: { v1: { url: 'v1.url', user: '', pass: '' } }
		@request = sinon.stub()
		@UserUpdater = SandboxedModule.require modulePath, requires:
			"logger-sharelatex": @logger
			"./UserGetter": @UserGetter
			"../../infrastructure/mongojs":@mongojs
			"metrics-sharelatex": timeAsyncMethod: sinon.stub()
			'settings-sharelatex': settings
			'request': @request

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

		it 'handle error', (done)->
			@UserUpdater.removeEmailAddress.callsArgWith(2, new Error('nope'))
			@UserUpdater.changeEmailAddress @stubbedUser._id, @newEmail, (err)=>
				should.exist(err)
				done()

	describe 'addEmailAddress', ->
		beforeEach ->
			@UserGetter.ensureUniqueEmailAddress = sinon.stub().callsArgWith(1)
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2, null)
			@request.callsArgWith(1, null, { statusCode: 201 })

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
				@request.calledOnce.should.equal true
				requestOptions = @request.lastCall.args[0]
				expectedUrl = "v1.url/api/v2/users/#{@stubbedUser._id}/affiliations"
				requestOptions.url.should.equal expectedUrl
				requestOptions.method.should.equal 'POST'

				body = requestOptions.body
				Object.keys(body).length.should.equal 4
				body.email.should.equal @newEmail
				body.university.should.equal affiliationOptions.university
				body.department.should.equal affiliationOptions.department
				body.role.should.equal affiliationOptions.role
				done()

		it 'handle error', (done)->
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2, new Error('nope'))

			@UserUpdater.addEmailAddress @stubbedUser._id, @newEmail, (err)=>
				@logger.err.called.should.equal true
				should.exist(err)
				done()

		it 'handle affiliation error', (done)->
			body = errors: 'affiliation error message'
			@request.callsArgWith(1, null, { statusCode: 422 }, body)
			@UserUpdater.addEmailAddress @stubbedUser._id, @newEmail, (err)=>
				err.message.should.have.string 422
				err.message.should.have.string body.errors
				@UserUpdater.updateUser.called.should.equal false
				done()

	describe 'removeEmailAddress', ->
		beforeEach ->
			@UserUpdater.updateUser = sinon.stub().callsArgWith(2, null, nMatched: 1)
			@request.callsArgWith(1, null, { statusCode: 404 })

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
				@request.calledOnce.should.equal true
				requestOptions = @request.lastCall.args[0]
				expectedUrl = "v1.url/api/v2/users/#{@stubbedUser._id}/affiliations/"
				expectedUrl += encodeURIComponent(@newEmail)
				requestOptions.url.should.equal expectedUrl
				requestOptions.method.should.equal 'DELETE'
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
			@request.callsArgWith(1, null, { statusCode: 500 })
			@UserUpdater.removeEmailAddress @stubbedUser._id, @newEmail, (err)=>
				err.message.should.exist
				@UserUpdater.updateUser.called.should.equal false
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



