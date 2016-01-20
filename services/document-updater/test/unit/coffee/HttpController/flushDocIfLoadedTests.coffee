sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/HttpController.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Errors.js"

describe "HttpController.flushDocIfLoaded", ->
	beforeEach ->
		@HttpController = SandboxedModule.require modulePath, requires:
			"./DocumentManager": @DocumentManager = {}
			"./ProjectManager": {}
			"logger-sharelatex" : @logger = { log: sinon.stub() }
			"./Metrics": @Metrics = {}

		@Metrics.Timer = class Timer
			done: sinon.stub()

		@project_id = "project-id-123"
		@doc_id = "doc-id-123"
		@lines = ["one", "two", "three"]
		@version = 42
		@res =
			send: sinon.stub()
		@req =
			params:
				project_id: @project_id
				doc_id: @doc_id
		@next = sinon.stub()

	describe "successfully", ->
		beforeEach ->
			@DocumentManager.flushDocIfLoadedWithLock = sinon.stub().callsArgWith(2)
			@HttpController.flushDocIfLoaded(@req, @res, @next)

		it "should flush the doc", ->
			@DocumentManager.flushDocIfLoadedWithLock
				.calledWith(@project_id, @doc_id)
				.should.equal true

		it "should return a successful No Content response", ->
			@res.send
				.calledWith(204)
				.should.equal true

		it "should log the request", ->
			@logger.log
				.calledWith(doc_id: @doc_id, project_id: @project_id, "flushing doc via http")
				.should.equal true

		it "should time the request", ->
			@Metrics.Timer::done.called.should.equal true

	describe "when an errors occurs", ->
		beforeEach ->
			@DocumentManager.flushDocIfLoadedWithLock = sinon.stub().callsArgWith(2, new Error("oops"))
			@HttpController.flushDocIfLoaded(@req, @res, @next)

		it "should call next with the error", ->
			@next
				.calledWith(new Error("oops"))
				.should.equal true
		


