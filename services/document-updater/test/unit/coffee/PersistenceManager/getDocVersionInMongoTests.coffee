sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/PersistenceManager.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Errors"
{ObjectId} = require("mongojs")

describe "PersistenceManager.getDocVersionInMongo", ->
	beforeEach ->
		@PersistenceManager = SandboxedModule.require modulePath, requires:
			"request": @request = sinon.stub()
			"settings-sharelatex": @Settings = {}
			"./Metrics": @Metrics =
				Timer: class Timer
					done: sinon.stub()
			"./mongojs":
				db: @db = { docOps: {} }
				ObjectId: ObjectId

		@doc_id = ObjectId().toString()
		@callback = sinon.stub()

	describe "getDocVersionInMongo", ->
		describe "when the doc exists", ->
			beforeEach ->
				@doc =
					version: @version = 42
				@db.docOps.find = sinon.stub().callsArgWith(2, null, [@doc])
				@PersistenceManager.getDocVersionInMongo @doc_id, @callback

			it "should look for the doc in the database", ->
				@db.docOps.find
					.calledWith({ doc_id: ObjectId(@doc_id) }, {version: 1})
					.should.equal true

			it "should call the callback with the version", ->
				@callback.calledWith(null, @version).should.equal true

		describe "when the doc doesn't exist", ->
			beforeEach ->
				@db.docOps.find = sinon.stub().callsArgWith(2, null, [])
				@PersistenceManager.getDocVersionInMongo @doc_id, @callback

			it "should call the callback with 0", ->
				@callback.calledWith(null, 0).should.equal true