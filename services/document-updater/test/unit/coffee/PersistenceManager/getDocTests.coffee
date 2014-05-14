sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/PersistenceManager.js"
SandboxedModule = require('sandboxed-module')
{ObjectId} = require("mongojs")

describe "PersistenceManager.getDoc", ->
	beforeEach ->
		@PersistenceManager = SandboxedModule.require modulePath, requires:
			"request": @request = sinon.stub()
			"settings-sharelatex": @Settings = {}
			"./Metrics": @Metrics =
				Timer: class Timer
					done: sinon.stub()
			"logger-sharelatex": @logger = {warn: sinon.stub()}
			"./mongojs":
				db: @db = { docOps: {} }
				ObjectId: ObjectId

		@project_id = ObjectId().toString()
		@doc_id = ObjectId().toString()
		@callback = sinon.stub()
		@lines = ["mock", "doc", "lines"]
		@version = 42

	describe "when the version is set in the web api but not Mongo", ->
		beforeEach ->
			@PersistenceManager.getDocFromWeb = sinon.stub().callsArgWith(2, null, @lines, @version)
			@PersistenceManager.getDocVersionInMongo = sinon.stub().callsArgWith(1, null, null)
			@PersistenceManager.getDoc @project_id, @doc_id, @callback

		it "should look up the doc in the web api", ->
			@PersistenceManager.getDocFromWeb
				.calledWith(@project_id, @doc_id)
				.should.equal true

		it "should look up the version in Mongo", ->
			@PersistenceManager.getDocVersionInMongo
				.calledWith(@doc_id)
				.should.equal true

		it "should call the callback with the lines and version", ->
			@callback.calledWith(null, @lines, @version).should.equal true

	describe "when the version is not set in the web api, but is in Mongo", ->
		beforeEach ->
			@PersistenceManager.getDocFromWeb = sinon.stub().callsArgWith(2, null, @lines, null)
			@PersistenceManager.getDocVersionInMongo = sinon.stub().callsArgWith(1, null, @version)
			@PersistenceManager.getDoc @project_id, @doc_id, @callback

		it "shoud log a warning", ->
			@logger.warn
				.calledWith(project_id: @project_id, doc_id: @doc_id, "loading doc version from mongo - deprecated")
				.should.equal true

		it "should call the callback with the lines and version", ->
			@callback.calledWith(null, @lines, @version).should.equal true

	describe "when the version in the web api is ahead of Mongo", ->
		beforeEach ->
			@PersistenceManager.getDocFromWeb = sinon.stub().callsArgWith(2, null, @lines, @version)
			@PersistenceManager.getDocVersionInMongo = sinon.stub().callsArgWith(1, null, @version - 20)
			@PersistenceManager.getDoc @project_id, @doc_id, @callback

		it "should call the callback with the web version", ->
			@callback.calledWith(null, @lines, @version).should.equal true

	describe "when the version in the web api is behind Mongo", ->
		beforeEach ->
			@PersistenceManager.getDocFromWeb = sinon.stub().callsArgWith(2, null, @lines, @version - 20)
			@PersistenceManager.getDocVersionInMongo = sinon.stub().callsArgWith(1, null, @version)
			@PersistenceManager.getDoc @project_id, @doc_id, @callback

		it "should call the callback with the Mongo version", ->
			@callback.calledWith(null, @lines, @version).should.equal true

	describe "when the version is not set", ->
		beforeEach ->
			@PersistenceManager.getDocFromWeb = sinon.stub().callsArgWith(2, null, @lines, null)
			@PersistenceManager.getDocVersionInMongo = sinon.stub().callsArgWith(1, null, null)
			@PersistenceManager.getDoc @project_id, @doc_id, @callback

		it "should call the callback with the lines and version = 0", ->
			@callback.calledWith(null, @lines, 0).should.equal true

