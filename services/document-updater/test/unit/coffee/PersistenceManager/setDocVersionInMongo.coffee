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

	describe "setDocVersionInMongo", ->
		beforeEach ->
			@version = 42
			@db.docOps.update = sinon.stub().callsArg(3)
			@PersistenceManager.setDocVersionInMongo @doc_id, @version, @callback

		it "should update the doc version", ->
			@db.docOps.update
				.calledWith({
					doc_id: ObjectId(@doc_id)
				}, {
					$set:
						version: @version
				}, {
					upsert: true 
				})
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true
