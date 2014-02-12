sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/HttpController.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Errors.js"

describe "HttpController - deleteProject", ->
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
			@ProjectManager.flushAndDeleteProjectWithLocks = sinon.stub().callsArgWith(1)
			@HttpController.deleteProject(@req, @res, @next)

		it "should delete the project", ->
			@ProjectManager.flushAndDeleteProjectWithLocks
				.calledWith(@project_id)
				.should.equal true

		it "should return a successful No Content response", ->
			@res.send
				.calledWith(204)
				.should.equal true

		it "should log the request", ->
			@logger.log
				.calledWith(project_id: @project_id, "deleting project via http")
				.should.equal true

		it "should time the request", ->
			@Metrics.Timer::done.called.should.equal true

	describe "when an errors occurs", ->
		beforeEach ->
			@ProjectManager.flushAndDeleteProjectWithLocks = sinon.stub().callsArgWith(1, new Error("oops"))
			@HttpController.deleteProject(@req, @res, @next)

		it "should call next with the error", ->
			@next
				.calledWith(new Error("oops"))
				.should.equal true
		




