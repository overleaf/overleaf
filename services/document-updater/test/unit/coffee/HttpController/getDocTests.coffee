sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/HttpController.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Errors.js"

describe "HttpController.getDoc", ->
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
		@ops = ["mock-op-1", "mock-op-2"]
		@version = 42
		@fromVersion = 42
		@track_changes_entries = { changes: "mock", comments: "mock" }
		@res =
			send: sinon.stub()
		@req =
			params:
				project_id: @project_id
				doc_id: @doc_id
		@next = sinon.stub()

	describe "when the document exists and no recent ops are requested", ->
		beforeEach ->
			@DocumentManager.getDocAndRecentOpsWithLock = sinon.stub().callsArgWith(3, null, @lines, @version, [], @track_changes_entries)
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
					track_changes_entries: @track_changes_entries
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
		

