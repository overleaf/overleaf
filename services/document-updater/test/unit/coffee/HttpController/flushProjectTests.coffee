sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/HttpController.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Errors.js"

describe "HttpController - flushProject", ->
	beforeEach ->
		@HttpController = SandboxedModule.require modulePath, requires:
			"./DocumentManager": @DocumentManager = {}
			"./ProjectManager": @ProjectManager = {}
			"logger-sharelatex" : @logger = { log: sinon.stub() }
			"./Metrics": @Metrics = {}

		@Metrics.Timer = class Timer
			done: sinon.stub()

		@project_id = "project-id-123"
		@res =
			send: sinon.stub()
		@req =
			params:
				project_id: @project_id
		@next = sinon.stub()

	describe "successfully", ->
		beforeEach ->
			@ProjectManager.flushProjectWithLocks = sinon.stub().callsArgWith(1)
			@HttpController.flushProject(@req, @res, @next)

		it "should flush the project", ->
			@ProjectManager.flushProjectWithLocks
				.calledWith(@project_id)
				.should.equal true

		it "should return a successful No Content response", ->
			@res.send
				.calledWith(204)
				.should.equal true

		it "should log the request", ->
			@logger.log
				.calledWith(project_id: @project_id, "flushing project via http")
				.should.equal true

		it "should time the request", ->
			@Metrics.Timer::done.called.should.equal true

	describe "when an errors occurs", ->
		beforeEach ->
			@ProjectManager.flushProjectWithLocks = sinon.stub().callsArgWith(1, new Error("oops"))
			@HttpController.flushProject(@req, @res, @next)

		it "should call next with the error", ->
			@next
				.calledWith(new Error("oops"))
				.should.equal true
		



