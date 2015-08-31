SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../../app/js/MongoHealthCheck'

describe "MongoHealthCheck", ->
	beforeEach ->
		@MongoHealthCheck = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @Settings = {}
			"./PersistenceManager": @PersistenceManager = {}
		@doc_id = "mock-doc-id"
		@callback = sinon.stub()

	describe "isAlive", ->
		describe "with no configured doc_id", ->
			beforeEach ->
				@MongoHealthCheck.isAlive @callback
			
			it "should call the call the callback with an error", ->
				@callback.calledOnce.should.equal true
				error = @callback.args[0][0]
				error.message.should.equal "No test doc_id configured"
			
		describe "when mongo returns within the timeout", ->
			beforeEach ->
				@Settings.smokeTest =
					doc_id: @doc_id
				@PersistenceManager.getDocVersionInMongo = sinon.stub().callsArg(1)
				@MongoHealthCheck.isAlive @callback
			
			it "should call PersistenceManager.getDocVersionInMongo", ->
				@PersistenceManager.getDocVersionInMongo
					.calledWith(@doc_id)
					.should.equal true
			
			it "should call the call the callback without an error", ->
				@callback.calledOnce.should.equal true
				@callback.calledWith(null).should.equal true
			
		describe "when mongo does not return within the timeout", ->
			beforeEach (done) ->
				@Settings.smokeTest =
					doc_id: @doc_id
					timeout: 50
				@PersistenceManager.getDocVersionInMongo = (doc_id, callback) ->
					setTimeout callback, 100
				@MongoHealthCheck.isAlive (@error) =>
					done()
			
			it "should call the call the callback with an error", ->
				@error.message.should.equal "Mongo did not return in 50ms"
			