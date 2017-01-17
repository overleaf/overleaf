sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/HttpController.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Errors.js"

describe "HttpController", ->
	beforeEach ->
		@HttpController = SandboxedModule.require modulePath, requires:
			"./DocumentManager": @DocumentManager = {}
			"./ProjectManager": @ProjectManager = {}
			"logger-sharelatex" : @logger = { log: sinon.stub() }
			"./Metrics": @Metrics = {}

		@Metrics.Timer = class Timer
			done: sinon.stub()
		@project_id = "project-id-123"
		@doc_id = "doc-id-123"
		@next = sinon.stub()
		@res =
			send: sinon.stub()
	
	describe "getDoc", ->
		beforeEach ->
			@lines = ["one", "two", "three"]
			@ops = ["mock-op-1", "mock-op-2"]
			@version = 42
			@fromVersion = 42
			@ranges = { changes: "mock", comments: "mock" }
			@req =
				params:
					project_id: @project_id
					doc_id: @doc_id

		describe "when the document exists and no recent ops are requested", ->
			beforeEach ->
				@DocumentManager.getDocAndRecentOpsWithLock = sinon.stub().callsArgWith(3, null, @lines, @version, [], @ranges)
				@HttpController.getDoc(@req, @res, @next)

			it "should get the doc", ->
				@DocumentManager.getDocAndRecentOpsWithLock
					.calledWith(@project_id, @doc_id, -1)
					.should.equal true

			it "should return the doc as JSON", ->
				@res.send
					.calledWith(JSON.stringify({
						id: @doc_id
						lines: @lines
						version: @version
						ops: []
						ranges: @ranges
					}))
					.should.equal true

			it "should log the request", ->
				@logger.log
					.calledWith(doc_id: @doc_id, project_id: @project_id, "getting doc via http")
					.should.equal true

			it "should time the request", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when recent ops are requested", ->
			beforeEach ->
				@DocumentManager.getDocAndRecentOpsWithLock = sinon.stub().callsArgWith(3, null, @lines, @version, @ops)
				@req.query = fromVersion: "#{@fromVersion}"
				@HttpController.getDoc(@req, @res, @next)

			it "should get the doc", ->
				@DocumentManager.getDocAndRecentOpsWithLock
					.calledWith(@project_id, @doc_id, @fromVersion)
					.should.equal true

			it "should return the doc as JSON", ->
				@res.send
					.calledWith(JSON.stringify({
						id: @doc_id
						lines: @lines
						version: @version
						ops: @ops
					}))
					.should.equal true

			it "should log the request", ->
				@logger.log
					.calledWith(doc_id: @doc_id, project_id: @project_id, "getting doc via http")
					.should.equal true

			it "should time the request", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when the document does not exist", ->
			beforeEach ->
				@DocumentManager.getDocAndRecentOpsWithLock = sinon.stub().callsArgWith(3, null, null, null)
				@HttpController.getDoc(@req, @res, @next)

			it "should call next with NotFoundError", ->
				@next
					.calledWith(new Errors.NotFoundError("not found"))
					.should.equal true

		describe "when an errors occurs", ->
			beforeEach ->
				@DocumentManager.getDocAndRecentOpsWithLock = sinon.stub().callsArgWith(3, new Error("oops"), null, null)
				@HttpController.getDoc(@req, @res, @next)

			it "should call next with the error", ->
				@next
					.calledWith(new Error("oops"))
					.should.equal true
	
	describe "setDoc", ->
		beforeEach ->
			@lines = ["one", "two", "three"]
			@source = "dropbox"
			@user_id = "user-id-123"
			@req =
				headers: {}
				params:
					project_id: @project_id
					doc_id: @doc_id
				body:
					lines: @lines
					source: @source
					user_id: @user_id

		describe "successfully", ->
			beforeEach ->
				@DocumentManager.setDocWithLock = sinon.stub().callsArgWith(5)
				@HttpController.setDoc(@req, @res, @next)

			it "should set the doc", ->
				@DocumentManager.setDocWithLock
					.calledWith(@project_id, @doc_id, @lines, @source, @user_id)
					.should.equal true

			it "should return a successful No Content response", ->
				@res.send
					.calledWith(204)
					.should.equal true

			it "should log the request", ->
				@logger.log
					.calledWith(doc_id: @doc_id, project_id: @project_id, lines: @lines, source: @source, user_id: @user_id, "setting doc via http")
					.should.equal true

			it "should time the request", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when an errors occurs", ->
			beforeEach ->
				@DocumentManager.setDocWithLock = sinon.stub().callsArgWith(5, new Error("oops"))
				@HttpController.setDoc(@req, @res, @next)

			it "should call next with the error", ->
				@next
					.calledWith(new Error("oops"))
					.should.equal true

		describe "when the payload is too large", ->
			beforeEach ->
				lines = []
				for _ in [0..200000]
					lines.push "test test test"
				@req.body.lines = lines
				@DocumentManager.setDocWithLock = sinon.stub().callsArgWith(5)
				@HttpController.setDoc(@req, @res, @next)

			it 'should send back a 406 response', ->
				@res.send.calledWith(406).should.equal true

			it 'should not call setDocWithLock', ->
				@DocumentManager.setDocWithLock.callCount.should.equal 0

	describe "flushProject", ->
		beforeEach ->
			@req =
				params:
					project_id: @project_id

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
	
	describe "flushDocIfLoaded", ->
		beforeEach ->
			@lines = ["one", "two", "three"]
			@version = 42
			@req =
				params:
					project_id: @project_id
					doc_id: @doc_id

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
	
	describe "flushAndDeleteDoc", ->
		beforeEach ->
			@req =
				params:
					project_id: @project_id
					doc_id: @doc_id

		describe "successfully", ->
			beforeEach ->
				@DocumentManager.flushAndDeleteDocWithLock = sinon.stub().callsArgWith(2)
				@HttpController.flushAndDeleteDoc(@req, @res, @next)

			it "should flush and delete the doc", ->
				@DocumentManager.flushAndDeleteDocWithLock
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should return a successful No Content response", ->
				@res.send
					.calledWith(204)
					.should.equal true

			it "should log the request", ->
				@logger.log
					.calledWith(doc_id: @doc_id, project_id: @project_id, "deleting doc via http")
					.should.equal true

			it "should time the request", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when an errors occurs", ->
			beforeEach ->
				@DocumentManager.flushAndDeleteDocWithLock = sinon.stub().callsArgWith(2, new Error("oops"))
				@HttpController.flushAndDeleteDoc(@req, @res, @next)

			it "should call next with the error", ->
				@next
					.calledWith(new Error("oops"))
					.should.equal true
	
	describe "deleteProject", ->
		beforeEach ->
			@req =
				params:
					project_id: @project_id

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
	
	describe "acceptChange", ->
		beforeEach ->
			@req =
				params:
					project_id: @project_id
					doc_id: @doc_id
					change_id: @change_id = "mock-change-od-1"

		describe "successfully", ->
			beforeEach ->
				@DocumentManager.acceptChangeWithLock = sinon.stub().callsArgWith(3)
				@HttpController.acceptChange(@req, @res, @next)

			it "should accept the change", ->
				@DocumentManager.acceptChangeWithLock
					.calledWith(@project_id, @doc_id, @change_id)
					.should.equal true

			it "should return a successful No Content response", ->
				@res.send
					.calledWith(204)
					.should.equal true

			it "should log the request", ->
				@logger.log
					.calledWith({@project_id, @doc_id, @change_id}, "accepting change via http")
					.should.equal true

			it "should time the request", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when an errors occurs", ->
			beforeEach ->
				@DocumentManager.acceptChangeWithLock = sinon.stub().callsArgWith(3, new Error("oops"))
				@HttpController.acceptChange(@req, @res, @next)

			it "should call next with the error", ->
				@next
					.calledWith(new Error("oops"))
					.should.equal true
