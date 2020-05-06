sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/DocumentManager.js"
SandboxedModule = require('sandboxed-module')
Errors = require "../../../../app/js/Errors"
tk = require "timekeeper"

describe "DocumentManager", ->
	beforeEach ->
		tk.freeze(new Date())
		@DocumentManager = SandboxedModule.require modulePath, requires:
			"./RedisManager": @RedisManager = {}
			"./ProjectHistoryRedisManager": @ProjectHistoryRedisManager = {}
			"./PersistenceManager": @PersistenceManager = {}
			"./HistoryManager": @HistoryManager =
				flushDocChangesAsync: sinon.stub()
				flushProjectChangesAsync: sinon.stub()
			"logger-sharelatex": @logger = {log: sinon.stub(), warn: sinon.stub()}
			"./DocOpsManager": @DocOpsManager = {}
			"./Metrics": @Metrics =
				Timer: class Timer
					done: sinon.stub()
			"./RealTimeRedisManager": @RealTimeRedisManager = {}
			"./DiffCodec": @DiffCodec = {}
			"./UpdateManager": @UpdateManager = {}
			"./RangesManager": @RangesManager = {}
		@project_id = "project-id-123"
		@projectHistoryId = "history-id-123"
		@projectHistoryType = "project-history"
		@doc_id = "doc-id-123"
		@user_id = 1234
		@callback = sinon.stub()
		@lines = ["one", "two", "three"]
		@version = 42
		@ranges = { comments: "mock", entries: "mock" }
		@pathname = '/a/b/c.tex'
		@unflushedTime = Date.now()
		@lastUpdatedAt = Date.now()
		@lastUpdatedBy = 'last-author-id'

	afterEach ->
		tk.reset()

	describe "flushAndDeleteDoc", ->
		describe "successfully", ->
			beforeEach ->
				@RedisManager.removeDocFromMemory = sinon.stub().callsArg(2)
				@DocumentManager.flushDocIfLoaded = sinon.stub().callsArgWith(2)
				@DocumentManager.flushAndDeleteDoc @project_id, @doc_id, {}, @callback

			it "should flush the doc", ->
				@DocumentManager.flushDocIfLoaded
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should remove the doc from redis", ->
				@RedisManager.removeDocFromMemory
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should call the callback without error", ->
				@callback.calledWith(null).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

			it "should flush to the history api", ->
				@HistoryManager.flushDocChangesAsync
					.calledWithExactly(@project_id, @doc_id)
					.should.equal true

		describe "when a flush error occurs", ->
			beforeEach ->
				@DocumentManager.flushDocIfLoaded = sinon.stub().callsArgWith(2, new Error("boom!"))
				@RedisManager.removeDocFromMemory = sinon.stub().callsArg(2)

			it "should not remove the doc from redis", (done) ->
				@DocumentManager.flushAndDeleteDoc @project_id, @doc_id, {}, (error) =>
					error.should.exist
					@RedisManager.removeDocFromMemory.called.should.equal false
					done()

			describe "when ignoring flush errors", ->
				it "should remove the doc from redis", (done) ->
					@DocumentManager.flushAndDeleteDoc @project_id, @doc_id, { ignoreFlushErrors: true }, (error) =>
						if error?
							return done(error)
						@RedisManager.removeDocFromMemory.called.should.equal true
						done()

	describe "flushDocIfLoaded", ->
		describe "when the doc is in Redis", ->
			beforeEach ->
				@RedisManager.getDoc = sinon.stub().callsArgWith(2, null, @lines, @version, @ranges, @pathname, @projectHistoryId, @unflushedTime, @lastUpdatedAt, @lastUpdatedBy)
				@RedisManager.clearUnflushedTime = sinon.stub().callsArgWith(1, null)
				@PersistenceManager.setDoc = sinon.stub().yields()
				@DocumentManager.flushDocIfLoaded @project_id, @doc_id, @callback

			it "should get the doc from redis", ->
				@RedisManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should write the doc lines to the persistence layer", ->
				@PersistenceManager.setDoc
					.calledWith(@project_id, @doc_id, @lines, @version, @ranges, @lastUpdatedAt, @lastUpdatedBy)
					.should.equal true

			it "should call the callback without error", ->
				@callback.calledWith(null).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when the document is not in Redis", ->
			beforeEach ->
				@RedisManager.getDoc = sinon.stub().callsArgWith(2, null, null, null, null)
				@PersistenceManager.setDoc = sinon.stub().yields()
				@DocOpsManager.flushDocOpsToMongo = sinon.stub().callsArgWith(2)
				@DocumentManager.flushDocIfLoaded @project_id, @doc_id, @callback

			it "should get the doc from redis", ->
				@RedisManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should not write anything to the persistence layer", ->
				@PersistenceManager.setDoc.called.should.equal false
				@DocOpsManager.flushDocOpsToMongo.called.should.equal false

			it "should call the callback without error", ->
				@callback.calledWith(null).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

	describe "getDocAndRecentOps", ->
		describe "with a previous version specified", ->
			beforeEach ->
				@DocumentManager.getDoc = sinon.stub().callsArgWith(2, null, @lines, @version, @ranges, @pathname, @projectHistoryId)
				@RedisManager.getPreviousDocOps = sinon.stub().callsArgWith(3, null, @ops)
				@DocumentManager.getDocAndRecentOps @project_id, @doc_id, @fromVersion, @callback

			it "should get the doc", ->
				@DocumentManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should get the doc ops", ->
				@RedisManager.getPreviousDocOps
					.calledWith(@doc_id, @fromVersion, @version)
					.should.equal true

			it "should call the callback with the doc info", ->
				@callback.calledWith(null, @lines, @version, @ops, @ranges, @pathname, @projectHistoryId).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

		describe "with no previous version specified", ->
			beforeEach ->
				@DocumentManager.getDoc = sinon.stub().callsArgWith(2, null, @lines, @version, @ranges, @pathname, @projectHistoryId)
				@RedisManager.getPreviousDocOps = sinon.stub().callsArgWith(3, null, @ops)
				@DocumentManager.getDocAndRecentOps @project_id, @doc_id, -1, @callback

			it "should get the doc", ->
				@DocumentManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should not need to get the doc ops", ->
				@RedisManager.getPreviousDocOps.called.should.equal false

			it "should call the callback with the doc info", ->
				@callback.calledWith(null, @lines, @version, [], @ranges, @pathname, @projectHistoryId).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

	describe "getDoc", ->
		describe "when the doc exists in Redis", ->
			beforeEach ->
				@RedisManager.getDoc = sinon.stub().callsArgWith(2, null, @lines, @version, @ranges, @pathname, @projectHistoryId, @unflushedTime)
				@DocumentManager.getDoc @project_id, @doc_id, @callback

			it "should get the doc from Redis", ->
				@RedisManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should call the callback with the doc info", ->
				@callback.calledWith(null, @lines, @version, @ranges, @pathname, @projectHistoryId, @unflushedTime, true).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when the doc does not exist in Redis", ->
			beforeEach ->
				@RedisManager.getDoc = sinon.stub().callsArgWith(2, null, null, null, null, null, null)
				@PersistenceManager.getDoc = sinon.stub().callsArgWith(2, null, @lines, @version, @ranges, @pathname, @projectHistoryId, @projectHistoryType)
				@RedisManager.putDocInMemory = sinon.stub().yields()
				@RedisManager.setHistoryType = sinon.stub().yields()
				@DocumentManager.getDoc @project_id, @doc_id, @callback

			it "should try to get the doc from Redis", ->
				@RedisManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should get the doc from the PersistenceManager", ->
				@PersistenceManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should set the doc in Redis", ->
				@RedisManager.putDocInMemory
					.calledWith(@project_id, @doc_id, @lines, @version, @ranges, @pathname, @projectHistoryId)
					.should.equal true

			it "should set the history type in Redis", ->
				@RedisManager.setHistoryType
					.calledWith(@doc_id, @projectHistoryType)
					.should.equal true

			it "should call the callback with the doc info", ->
				@callback.calledWith(null, @lines, @version, @ranges, @pathname, @projectHistoryId, null, false).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

	describe "setDoc", ->
		describe "with plain tex lines", ->
			beforeEach ->
				@beforeLines = ["before", "lines"]
				@afterLines = ["after", "lines"]
				@ops = [{ i: "foo", p: 4 }, { d: "bar", p: 42 }]
				@DocumentManager.getDoc = sinon.stub().callsArgWith(2, null, @beforeLines, @version, @ranges, @pathname, @projectHistoryId, @unflushedTime, true)
				@DiffCodec.diffAsShareJsOp = sinon.stub().callsArgWith(2, null, @ops)
				@UpdateManager.applyUpdate = sinon.stub().callsArgWith(3, null)
				@DocumentManager.flushDocIfLoaded = sinon.stub().callsArg(2)
				@DocumentManager.flushAndDeleteDoc = sinon.stub().callsArg(3)

			describe "when already loaded", ->
				beforeEach ->
					@DocumentManager.setDoc @project_id, @doc_id, @afterLines, @source, @user_id, false, @callback

				it "should get the current doc lines", ->
					@DocumentManager.getDoc
						.calledWith(@project_id, @doc_id)
						.should.equal true

				it "should return a diff of the old and new lines", ->
					@DiffCodec.diffAsShareJsOp
						.calledWith(@beforeLines, @afterLines)
						.should.equal true

				it "should apply the diff as a ShareJS op", ->
					@UpdateManager.applyUpdate
						.calledWith(
							@project_id,
							@doc_id,
							{
								doc: @doc_id,
								v: @version,
								op: @ops,
								meta: {
									type: "external"
									source: @source
									user_id: @user_id
								}
							}
						)
						.should.equal true

				it "should flush the doc to Mongo", ->
					@DocumentManager.flushDocIfLoaded
						.calledWith(@project_id, @doc_id)
						.should.equal true

				it "should not flush the project history", ->
					@HistoryManager.flushProjectChangesAsync
						.called.should.equal false

				it "should call the callback", ->
					@callback.calledWith(null).should.equal true

				it "should time the execution", ->
					@Metrics.Timer::done.called.should.equal true

			describe "when not already loaded", ->
				beforeEach ->
					@DocumentManager.getDoc = sinon.stub().callsArgWith(2, null, @beforeLines, @version, @pathname, null, false)
					@DocumentManager.setDoc @project_id, @doc_id, @afterLines, @source, @user_id, false, @callback

				it "should flush and delete the doc from the doc updater", ->
					@DocumentManager.flushAndDeleteDoc
						.calledWith(@project_id, @doc_id, {})
						.should.equal true

				it "should not flush the project history", ->
					@HistoryManager.flushProjectChangesAsync
						.calledWithExactly(@project_id)
						.should.equal true

			describe "without new lines", ->
				beforeEach ->
					@DocumentManager.setDoc @project_id, @doc_id, null, @source, @user_id, false, @callback

				it "should return the callback with an error", ->
					@callback.calledWith(new Error("No lines were passed to setDoc"))

				it "should not try to get the doc lines", ->
					@DocumentManager.getDoc.called.should.equal false

			describe "with the undoing flag", ->
				beforeEach ->
					# Copy ops so we don't interfere with other tests
					@ops = [{ i: "foo", p: 4 }, { d: "bar", p: 42 }]
					@DiffCodec.diffAsShareJsOp = sinon.stub().callsArgWith(2, null, @ops)
					@DocumentManager.setDoc @project_id, @doc_id, @afterLines, @source, @user_id, true, @callback

				it "should set the undo flag on each op", ->
					for op in @ops
						op.u.should.equal true

	describe "acceptChanges", ->
		beforeEach ->
			@change_id = "mock-change-id"
			@change_ids = [ "mock-change-id-1", "mock-change-id-2", "mock-change-id-3", "mock-change-id-4" ]
			@version = 34
			@lines = ["original", "lines"]
			@ranges = { entries: "mock", comments: "mock" }
			@updated_ranges = { entries: "updated", comments: "updated" }
			@DocumentManager.getDoc = sinon.stub().yields(null, @lines, @version, @ranges)
			@RangesManager.acceptChanges = sinon.stub().yields(null, @updated_ranges)
			@RedisManager.updateDocument = sinon.stub().yields()

		describe "successfully with a single change", ->
			beforeEach ->
				@DocumentManager.acceptChanges @project_id, @doc_id, [ @change_id ], @callback

			it "should get the document's current ranges", ->
				@DocumentManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should apply the accept change to the ranges", ->
				@RangesManager.acceptChanges
					.calledWith([ @change_id ], @ranges)
					.should.equal true

			it "should save the updated ranges", ->
				@RedisManager.updateDocument
					.calledWith(@project_id, @doc_id, @lines, @version, [], @updated_ranges, {})
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "successfully with multiple changes", ->
			beforeEach ->
				@DocumentManager.acceptChanges @project_id, @doc_id, @change_ids, @callback

			it "should apply the accept change to the ranges", ->
				@RangesManager.acceptChanges
					.calledWith(@change_ids, @ranges)
					.should.equal true

		describe "when the doc is not found", ->
			beforeEach ->
				@DocumentManager.getDoc = sinon.stub().yields(null, null, null, null)
				@DocumentManager.acceptChanges @project_id, @doc_id, [ @change_id ], @callback

			it "should not save anything", ->
				@RedisManager.updateDocument.called.should.equal false

			it "should call the callback with a not found error", ->
				error = new Errors.NotFoundError("document not found: #{@doc_id}")
				@callback.calledWith(error).should.equal true

	describe "deleteComment", ->
		beforeEach ->
			@comment_id = "mock-comment-id"
			@version = 34
			@lines = ["original", "lines"]
			@ranges = { comments: ["one", "two", "three"] }
			@updated_ranges = { comments: ["one", "three"] }
			@DocumentManager.getDoc = sinon.stub().yields(null, @lines, @version, @ranges)
			@RangesManager.deleteComment = sinon.stub().yields(null, @updated_ranges)
			@RedisManager.updateDocument = sinon.stub().yields()

		describe "successfully", ->
			beforeEach ->
				@DocumentManager.deleteComment @project_id, @doc_id, @comment_id, @callback

			it "should get the document's current ranges", ->
				@DocumentManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should delete the comment from the ranges", ->
				@RangesManager.deleteComment
					.calledWith(@comment_id, @ranges)
					.should.equal true

			it "should save the updated ranges", ->
				@RedisManager.updateDocument
					.calledWith(@project_id, @doc_id, @lines, @version, [], @updated_ranges, {})
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when the doc is not found", ->
			beforeEach ->
				@DocumentManager.getDoc = sinon.stub().yields(null, null, null, null)
				@DocumentManager.acceptChanges @project_id, @doc_id, [ @comment_id ], @callback

			it "should not save anything", ->
				@RedisManager.updateDocument.called.should.equal false

			it "should call the callback with a not found error", ->
				error = new Errors.NotFoundError("document not found: #{@doc_id}")
				@callback.calledWith(error).should.equal true

	describe "getDocAndFlushIfOld", ->
		beforeEach ->
			@DocumentManager.flushDocIfLoaded = sinon.stub().callsArg(2)

		describe "when the doc is in Redis", ->
			describe "and has changes to be flushed", ->
				beforeEach ->
					@DocumentManager.getDoc = sinon.stub().callsArgWith(2, null, @lines, @version, @ranges, @projectHistoryId, @pathname, Date.now() - 1e9, true)
					@DocumentManager.getDocAndFlushIfOld @project_id, @doc_id, @callback

				it "should get the doc", ->
					@DocumentManager.getDoc
						.calledWith(@project_id, @doc_id)
						.should.equal true

				it "should flush the doc", ->
					@DocumentManager.flushDocIfLoaded
					.calledWith(@project_id, @doc_id)
					.should.equal true

				it "should call the callback with the lines and versions", ->
					@callback.calledWith(null, @lines, @version).should.equal true

			describe "and has only changes that don't need to be flushed", ->
				beforeEach ->
					@DocumentManager.getDoc = sinon.stub().callsArgWith(2, null, @lines, @version, @ranges, @pathname, Date.now() - 100, true)
					@DocumentManager.getDocAndFlushIfOld @project_id, @doc_id, @callback

				it "should get the doc", ->
					@DocumentManager.getDoc
						.calledWith(@project_id, @doc_id)
						.should.equal true

				it "should not flush the doc", ->
					@DocumentManager.flushDocIfLoaded
					.called.should.equal false

				it "should call the callback with the lines and versions", ->
					@callback.calledWith(null, @lines, @version).should.equal true

		describe "when the doc is not in Redis", ->
			beforeEach ->
				@DocumentManager.getDoc = sinon.stub().callsArgWith(2, null, @lines, @version, @ranges, null, false)
				@DocumentManager.getDocAndFlushIfOld @project_id, @doc_id, @callback

			it "should get the doc", ->
				@DocumentManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should not flush the doc", ->
				@DocumentManager.flushDocIfLoaded
				.called.should.equal false

			it "should call the callback with the lines and versions", ->
				@callback.calledWith(null, @lines, @version).should.equal true

	describe "renameDoc", ->
		beforeEach ->
			@update = 'some-update'
			@RedisManager.renameDoc = sinon.stub().yields()

		describe "successfully", ->
			beforeEach ->
				@DocumentManager.renameDoc @project_id, @doc_id, @user_id, @update, @projectHistoryId, @callback

			it "should rename the document", ->
				@RedisManager.renameDoc
					.calledWith(@project_id, @doc_id, @user_id, @update, @projectHistoryId)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

	describe "resyncDocContents", ->
		describe "when doc is loaded in redis", ->
			beforeEach ->
				@RedisManager.getDoc = sinon.stub().callsArgWith(2, null, @lines, @version, @ranges, @pathname, @projectHistoryId)
				@ProjectHistoryRedisManager.queueResyncDocContent = sinon.stub()
				@DocumentManager.resyncDocContents @project_id, @doc_id, @callback

			it "gets the doc contents from redis", ->
				@RedisManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "queues a resync doc content update", ->
				@ProjectHistoryRedisManager.queueResyncDocContent
					.calledWith(@project_id, @projectHistoryId, @doc_id, @lines, @version, @pathname, @callback)
					.should.equal true

		describe "when doc is not loaded in redis", ->
			beforeEach ->
				@RedisManager.getDoc = sinon.stub().callsArgWith(2, null)
				@PersistenceManager.getDoc = sinon.stub().callsArgWith(2, null, @lines, @version, @ranges, @pathname, @projectHistoryId)
				@ProjectHistoryRedisManager.queueResyncDocContent = sinon.stub()
				@DocumentManager.resyncDocContents @project_id, @doc_id, @callback

			it "tries to get the doc contents from redis", ->
				@RedisManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "gets the doc contents from web", ->
				@PersistenceManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "queues a resync doc content update", ->
				@ProjectHistoryRedisManager.queueResyncDocContent
					.calledWith(@project_id, @projectHistoryId, @doc_id, @lines, @version, @pathname, @callback)
					.should.equal true
