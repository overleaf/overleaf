sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/ProjectManager.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Errors.js"

describe "ProjectManager - getProjectDocsAndFlushIfOld", ->
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
		@doc_versions = [111, 222, 333]

	describe "successfully", ->
		beforeEach (done) ->
			@doc_ids = ["doc-id-1", "doc-id-2", "doc-id-3"]
			@doc_lines = [["aaa","aaa"],["bbb","bbb"],["ccc","ccc"]]
			@docs = [
				{_id: @doc_ids[0], lines: @doc_lines[0], v: @doc_versions[0]}
				{_id: @doc_ids[1], lines: @doc_lines[1], v: @doc_versions[1]}
				{_id: @doc_ids[2], lines: @doc_lines[2], v: @doc_versions[2]}
			]
			@RedisManager.checkOrSetProjectState = sinon.stub().callsArgWith(2, null)
			@RedisManager.getDocIdsInProject = sinon.stub().callsArgWith(1, null, @doc_ids)
			@DocumentManager.getDocAndFlushIfOldWithLock = sinon.stub()
			@DocumentManager.getDocAndFlushIfOldWithLock.withArgs(@project_id, @doc_ids[0])
				.callsArgWith(2, null, @doc_lines[0], @doc_versions[0])
			@DocumentManager.getDocAndFlushIfOldWithLock.withArgs(@project_id, @doc_ids[1])
				.callsArgWith(2, null, @doc_lines[1], @doc_versions[1])
			@DocumentManager.getDocAndFlushIfOldWithLock.withArgs(@project_id, @doc_ids[2])
				.callsArgWith(2, null, @doc_lines[2], @doc_versions[2])
			@ProjectManager.getProjectDocsAndFlushIfOld @project_id, @projectStateHash, @excludeVersions,  (error, docs) =>
				@callback(error, docs)
				done()

		it "should check the project state", ->
			@RedisManager.checkOrSetProjectState
				.calledWith(@project_id, @projectStateHash)
				.should.equal true

		it "should get the doc ids in the project", ->
			@RedisManager.getDocIdsInProject
				.calledWith(@project_id)
				.should.equal true

		it "should call the callback without error", ->
			@callback.calledWith(null, @docs).should.equal true

		it "should time the execution", ->
			@Metrics.Timer::done.called.should.equal true

	describe "when the state does not match", ->
		beforeEach (done) ->
			@doc_ids = ["doc-id-1", "doc-id-2", "doc-id-3"]
			@RedisManager.checkOrSetProjectState = sinon.stub().callsArgWith(2, null, true)
			@ProjectManager.getProjectDocsAndFlushIfOld @project_id, @projectStateHash, @excludeVersions,  (error, docs) =>
				@callback(error, docs)
				done()

		it "should check the project state", ->
			@RedisManager.checkOrSetProjectState
				.calledWith(@project_id, @projectStateHash)
				.should.equal true

		it "should call the callback with an error", ->
			@callback.calledWith(new Errors.ProjectStateChangedError("project state changed")).should.equal true

		it "should time the execution", ->
			@Metrics.Timer::done.called.should.equal true

	describe "when a doc errors", ->
		beforeEach (done) ->
			@doc_ids = ["doc-id-1", "doc-id-2", "doc-id-3"]
			@RedisManager.checkOrSetProjectState = sinon.stub().callsArgWith(2, null)
			@RedisManager.getDocIdsInProject = sinon.stub().callsArgWith(1, null, @doc_ids)
			@DocumentManager.getDocAndFlushIfOldWithLock = sinon.stub()
			@DocumentManager.getDocAndFlushIfOldWithLock.withArgs(@project_id, "doc-id-1")
				.callsArgWith(2, null, ["test doc content"], @doc_versions[1])
			@DocumentManager.getDocAndFlushIfOldWithLock.withArgs(@project_id, "doc-id-2")
				.callsArgWith(2, @error = new Error("oops")) # trigger an error
			@ProjectManager.getProjectDocsAndFlushIfOld @project_id, @projectStateHash, @excludeVersions, (error, docs) =>
				@callback(error)
				done()

		it "should record the error", ->
			@logger.error
				.calledWith(err: @error, project_id: @project_id, doc_id: "doc-id-2", "error getting project doc lines in getProjectDocsAndFlushIfOld")
				.should.equal true

		it "should call the callback with an error", ->
			@callback.calledWith(new Error("oops")).should.equal true

		it "should time the execution", ->
			@Metrics.Timer::done.called.should.equal true

	describe "clearing the project state with clearProjectState", ->
		beforeEach (done) ->
			@RedisManager.clearProjectState = sinon.stub().callsArg(1)
			@ProjectManager.clearProjectState @project_id, (error) =>
				@callback(error)
				done()

		it "should clear the project state", ->
			@RedisManager.clearProjectState
			.calledWith(@project_id)
			.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true
