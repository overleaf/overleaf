sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/PersistenceManager.js"
SandboxedModule = require('sandboxed-module')

describe "PersistenceManager.setDoc", ->
	beforeEach ->
		@PersistenceManager = SandboxedModule.require modulePath, requires:
			"request": @request = sinon.stub()
			"settings-sharelatex": @Settings = {}
			"./Metrics": @Metrics =
				Timer: class Timer
					done: sinon.stub()
			"logger-sharelatex": @logger = {warn: sinon.stub()}

		@project_id = "mock-project-id"
		@doc_id = "mock-doc-id"
		@callback = sinon.stub()
		@lines = ["mock", "doc", "lines"]

		@PersistenceManager.setDocInWeb = sinon.stub().callsArg(3)
		@PersistenceManager.setDocVersionInMongo = sinon.stub().callsArg(2)

		@PersistenceManager.setDoc @project_id, @doc_id, @lines, @version, @callback

	it "should set the doc in the web api", ->
		@PersistenceManager.setDocInWeb
			.calledWith(@project_id, @doc_id, @lines)
			.should.equal true

	it "should set the doc version in mongo", ->
		@PersistenceManager.setDocVersionInMongo
			.calledWith(@doc_id, @version)
			.should.equal true

	it "should call the callback", ->
		@callback.called.should.equal true
