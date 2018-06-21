should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Security/OneTimeTokenHandler"
expect = require("chai").expect
Errors = require "../../../../app/js/Features/Errors/Errors"
tk = require("timekeeper")

describe "OneTimeTokenHandler", ->
	beforeEach ->
		tk.freeze Date.now() # freeze the time for these tests
		@stubbedToken = "mock-token"
		@callback = sinon.stub()
		@OneTimeTokenHandler = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": log:->
			"crypto": randomBytes: () => @stubbedToken
			"../Errors/Errors": Errors
			"../../infrastructure/mongojs": db: @db = tokens: {}

	afterEach ->
		tk.reset()

	describe "getNewToken", ->
		beforeEach ->
			@db.tokens.insert = sinon.stub().yields()

		describe 'normally', ->
			beforeEach ->
				@OneTimeTokenHandler.getNewToken 'password', 'mock-data-to-store', @callback

			it "should insert a generated token with a 1 hour expiry", ->
				@db.tokens.insert
					.calledWith({
						use: 'password'
						token: @stubbedToken,
						createdAt: new Date(),
						expiresAt: new Date(Date.now() + 60 * 60 * 1000)
						data: 'mock-data-to-store'
					})
					.should.equal true

			it 'should call the callback with the token', ->
				@callback.calledWith(null, @stubbedToken).should.equal true

		describe 'with an optional expiresIn parameter', ->
			beforeEach ->
				@OneTimeTokenHandler.getNewToken 'password', 'mock-data-to-store', { expiresIn: 42 }, @callback

			it "should insert a generated token with a custom expiry", ->
				@db.tokens.insert
					.calledWith({
						use: 'password'
						token: @stubbedToken,
						createdAt: new Date(),
						expiresAt: new Date(Date.now() + 42 * 1000)
						data: 'mock-data-to-store'
					})
					.should.equal true

			it 'should call the callback with the token', ->
				@callback.calledWith(null, @stubbedToken).should.equal true

	describe "getValueFromTokenAndExpire", ->
		describe 'successfully', ->
			beforeEach ->
				@db.tokens.findAndModify = sinon.stub().yields(null, { data: 'mock-data' })
				@OneTimeTokenHandler.getValueFromTokenAndExpire 'password', 'mock-token', @callback

			it 'should expire the token', ->
				@db.tokens.findAndModify
					.calledWith({
						query: {
							use: 'password'
							token: 'mock-token',
							expiresAt: { $gt: new Date() },
							usedAt: { $exists: false }
						},
						update: {
							$set: { usedAt: new Date() }
						}
					})
					.should.equal true

			it 'should return the data', ->
				@callback.calledWith(null, 'mock-data').should.equal true

		describe 'when a valid token is not found', ->
			beforeEach ->
				@db.tokens.findAndModify = sinon.stub().yields(null, null)
				@OneTimeTokenHandler.getValueFromTokenAndExpire 'password', 'mock-token', @callback

			it 'should return a NotFoundError', ->
				@callback
					.calledWith(sinon.match.instanceOf(Errors.NotFoundError))
					.should.equal true





