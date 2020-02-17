sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/HttpController.js"
SandboxedModule = require('sandboxed-module')

describe "HttpController", ->
	beforeEach ->
		@HttpController = SandboxedModule.require modulePath, requires:
			"logger-sharelatex": { log: sinon.stub() }
			"./UpdatesManager": @UpdatesManager = {}
			"./DiffManager": @DiffManager = {}
			"./RestoreManager": @RestoreManager = {}
			"./PackManager": @PackManager = {}
			"./DocArchiveManager": @DocArchiveManager = {}
			"./HealthChecker": @HealthChecker = {}
		@doc_id = "doc-id-123"
		@project_id = "project-id-123"
		@next = sinon.stub()
		@user_id = "mock-user-123"
		@now = Date.now()

	describe "flushDoc", ->
		beforeEach ->
			@req =
				params:
					doc_id: @doc_id
					project_id: @project_id
			@res =
				send: sinon.stub()
			@UpdatesManager.processUncompressedUpdatesWithLock = sinon.stub().callsArg(2)
			@HttpController.flushDoc @req, @res, @next

		it "should process the updates", ->
			@UpdatesManager.processUncompressedUpdatesWithLock
				.calledWith(@project_id, @doc_id)
				.should.equal true

		it "should return a success code", ->
			@res.send.calledWith(204).should.equal true

	describe "flushProject", ->
		beforeEach ->
			@req =
				params:
					project_id: @project_id
			@res =
				send: sinon.stub()
			@UpdatesManager.processUncompressedUpdatesForProject = sinon.stub().callsArg(1)
			@HttpController.flushProject @req, @res, @next

		it "should process the updates", ->
			@UpdatesManager.processUncompressedUpdatesForProject
				.calledWith(@project_id)
				.should.equal true

		it "should return a success code", ->
			@res.send.calledWith(204).should.equal true


	describe "getDiff", ->
		beforeEach ->
			@from = 42
			@to = 45
			@req =
				params:
					doc_id: @doc_id
					project_id: @project_id
				query:
					from: @from.toString()
					to: @to.toString()
			@res =
				json: sinon.stub()
			@diff = [ u: "mock-diff" ]
			@DiffManager.getDiff = sinon.stub().callsArgWith(4, null, @diff)
			@HttpController.getDiff @req, @res, @next

		it "should get the diff", ->
			@DiffManager.getDiff
				.calledWith(@project_id, @doc_id, parseInt(@from, 10), parseInt(@to, 10))
				.should.equal true

		it "should return the diff", ->
			@res.json.calledWith({diff: @diff}).should.equal true

	describe "getUpdates", ->
		beforeEach ->
			@before = Date.now()
			@nextBeforeTimestamp = @before - 100
			@min_count = 10
			@req =
				params:
					project_id: @project_id
				query:
					before:    @before.toString()
					min_count: @min_count.toString()
			@res =
				json: sinon.stub()
			@updates = ["mock-summarized-updates"]
			@UpdatesManager.getSummarizedProjectUpdates = sinon.stub().callsArgWith(2, null, @updates, @nextBeforeTimestamp)
			@HttpController.getUpdates @req, @res, @next

		it "should get the updates", ->
			@UpdatesManager.getSummarizedProjectUpdates
				.calledWith(@project_id, before: @before, min_count: @min_count)
				.should.equal true

		it "should return the formatted updates", ->
			@res.json.calledWith({updates: @updates, nextBeforeTimestamp: @nextBeforeTimestamp}).should.equal true

	describe "RestoreManager", ->
		beforeEach ->
			@version = "42"
			@req =
				params:
					doc_id: @doc_id
					project_id: @project_id
					version: @version
				headers:
					"x-user-id": @user_id
			@res =
				send: sinon.stub()

			@RestoreManager.restoreToBeforeVersion = sinon.stub().callsArg(4)
			@HttpController.restore @req, @res, @next

		it "should restore the document", ->
			@RestoreManager.restoreToBeforeVersion
				.calledWith(@project_id, @doc_id, parseInt(@version, 10), @user_id)
				.should.equal true

		it "should return a success code", ->
			@res.send.calledWith(204).should.equal true

