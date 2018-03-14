sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/ProjectManager.js"
SandboxedModule = require('sandboxed-module')

describe "ProjectManager - flushProject", ->
	beforeEach ->
		@ProjectManager = SandboxedModule.require modulePath, requires:
			"./RedisManager": @RedisManager = {}
			"./ProjectHistoryRedisManager": @ProjectHistoryRedisManager = {}
			"./DocumentManager": @DocumentManager = {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
			"./HistoryManager": @HistoryManager = {}
			"./Metrics": @Metrics =
				Timer: class Timer
					done: sinon.stub()
		@project_id = "project-id-123"
		@callback = sinon.stub()

	describe "successfully", ->
		beforeEach (done) ->
			@doc_ids = ["doc-id-1", "doc-id-2", "doc-id-3"]
			@RedisManager.getDocIdsInProject = sinon.stub().callsArgWith(1, null, @doc_ids)
			@DocumentManager.flushDocIfLoadedWithLock = sinon.stub().callsArg(2)
			@ProjectManager.flushProjectWithLocks @project_id, (error) =>
				@callback(error)
				done()

		it "should get the doc ids in the project", ->
			@RedisManager.getDocIdsInProject
				.calledWith(@project_id)
				.should.equal true
		
		it "should flush each doc in the project", ->
			for doc_id in @doc_ids
				@DocumentManager.flushDocIfLoadedWithLock
					.calledWith(@project_id, doc_id)
					.should.equal true

		it "should call the callback without error", ->
			@callback.calledWith(null).should.equal true

		it "should time the execution", ->
			@Metrics.Timer::done.called.should.equal true

	describe "when a doc errors", ->
		beforeEach (done) ->
			@doc_ids = ["doc-id-1", "doc-id-2", "doc-id-3"]
			@RedisManager.getDocIdsInProject = sinon.stub().callsArgWith(1, null, @doc_ids)
			@DocumentManager.flushDocIfLoadedWithLock = sinon.spy (project_id, doc_id, callback = (error) ->) =>
				if doc_id == "doc-id-1"
					callback(@error = new Error("oops, something went wrong"))
				else
					callback()
			@ProjectManager.flushProjectWithLocks @project_id, (error) =>
				@callback(error)
				done()
			
		it "should still flush each doc in the project", ->
			for doc_id in @doc_ids
				@DocumentManager.flushDocIfLoadedWithLock
					.calledWith(@project_id, doc_id)
					.should.equal true

		it "should record the error", ->
			@logger.error
				.calledWith(err: @error, project_id: @project_id, doc_id: "doc-id-1", "error flushing doc")
				.should.equal true

		it "should call the callback with an error", ->
			@callback.calledWith(new Error()).should.equal true

		it "should time the execution", ->
			@Metrics.Timer::done.called.should.equal true
