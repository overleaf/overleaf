should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/User/UserGetter"
expect = require("chai").expect

describe "UserGetter", ->

	beforeEach ->
		@fakeUser =
			_id: '12390i'
			email: 'email2@foo.bar'
			emails: [
				{ email: 'email1@foo.bar' }
				{ email: 'email2@foo.bar' }
			]
		@findOne = sinon.stub().callsArgWith(2, null, @fakeUser)
		@Mongo =
			db: users: findOne: @findOne
			ObjectId: (id) -> return id

		@UserGetter = SandboxedModule.require modulePath, requires:
			"logger-sharelatex": log:->
			"../../infrastructure/mongojs": @Mongo
			"metrics-sharelatex": timeAsyncMethod: sinon.stub()

	describe "getUser", ->
		it "should get user", (done)->
			query = _id: 'foo'
			projection = email: 1
			@UserGetter.getUser query, projection, (error, user) =>
				@findOne.called.should.equal true
				@findOne.calledWith(query, projection).should.equal true
				user.should.deep.equal @fakeUser
				done()

		it "should not allow email in query", (done)->
			@UserGetter.getUser email: 'foo@bar.com', {}, (error, user) =>
				error.should.exist
				done()

	describe "getUserFullEmails", -
		it "should get user", (done)->
			@UserGetter.getUser = sinon.stub().callsArgWith(2, null, @fakeUser)
			projection = email: 1, emails: 1
			@UserGetter.getUserFullEmails @fakeUser._id, (error, fullEmails) =>
				@UserGetter.getUser.called.should.equal true
				@UserGetter.getUser.calledWith(@fakeUser._id, projection).should.equal true
				done()

		it "should fetch emails data", (done)->
			@UserGetter.getUser = sinon.stub().callsArgWith(2, null, @fakeUser)
			@UserGetter.getUserFullEmails @fakeUser._id, (error, fullEmails) =>
				assert.deepEqual fullEmails, [
					{ email: 'email1@foo.bar', default: false }
					{ email: 'email2@foo.bar', default: true }
				]
				done()

	describe "getUserbyMainEmail", ->
		it "query user by main email", (done)->
			email = 'hello@world.com'
			projection = emails: 1
			@UserGetter.getUserByMainEmail email, projection, (error, user) =>
				@findOne.called.should.equal true
				@findOne.calledWith(email: email, projection).should.equal true
				done()

		it "return user if found", (done)->
			email = 'hello@world.com'
			@UserGetter.getUserByMainEmail email, (error, user) =>
				user.should.deep.equal @fakeUser
				done()

		it "trim email", (done)->
			email = 'hello@world.com'
			@UserGetter.getUserByMainEmail " #{email} ", (error, user) =>
				@findOne.called.should.equal true
				@findOne.calledWith(email: email).should.equal true
				done()

	describe "getUserByAnyEmail", ->
		it "query user for any email", (done)->
			email = 'hello@world.com'
			expectedQuery =
				emails: { $exists: true }
				'emails.email': email
			projection = emails: 1
			@UserGetter.getUserByAnyEmail " #{email} ", projection, (error, user) =>
				@findOne.calledWith(expectedQuery, projection).should.equal true
				user.should.deep.equal @fakeUser
				done()

		it "query contains $exists:true so partial index is used", (done)->
			expectedQuery =
				emails: { $exists: true }
				'emails.email': ''
			@UserGetter.getUserByAnyEmail '', {}, (error, user) =>
				@findOne.calledWith(expectedQuery, {}).should.equal true
				done()

		it "checks main email as well", (done)->
			@findOne.callsArgWith(2, null, null)
			email = 'hello@world.com'
			projection = emails: 1
			@UserGetter.getUserByAnyEmail " #{email} ", projection, (error, user) =>
				@findOne.calledTwice.should.equal true
				@findOne.calledWith(email: email, projection).should.equal true
				done()

	describe 'ensureUniqueEmailAddress', ->
		beforeEach ->
			@UserGetter.getUserByAnyEmail = sinon.stub()

		it 'should return error if existing user is found', (done)->
			@UserGetter.getUserByAnyEmail.callsArgWith(1, null, @fakeUser)
			@UserGetter.ensureUniqueEmailAddress @newEmail, (err)=>
				should.exist(err)
				err.message.should.equal 'alread_exists'
				done()

		it 'should return null if no user is found', (done)->
			@UserGetter.getUserByAnyEmail.callsArgWith(1)
			@UserGetter.ensureUniqueEmailAddress @newEmail, (err)=>
				should.not.exist(err)
				done()
