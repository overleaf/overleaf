sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/DocumentManager.js"
SandboxedModule = require('sandboxed-module')

describe "DocumentManager", ->
	beforeEach ->
		@DocumentManager = SandboxedModule.require modulePath, requires:
			"./RedisManager": @RedisManager = {}
			"./PersistenceManager": @PersistenceManager = {}
			"./HistoryManager": @HistoryManager = {}
			"logger-sharelatex": @logger = {log: sinon.stub()}
			"./DocOpsManager": @DocOpsManager = {}
			"./Metrics": @Metrics =
				Timer: class Timer
					done: sinon.stub()
			"./WebRedisManager": @WebRedisManager = {}
			"./DiffCodec": @DiffCodec = {}
			"./UpdateManager": @UpdateManager = {}
		@project_id = "project-id-123"
		@doc_id = "doc-id-123"
		@callback = sinon.stub()
		@lines = ["one", "two", "three"]
		@version = 42
		@track_changes_entries = { comments: "mock", entries: "mock" }
		@track_changes_on = true

	describe "flushAndDeleteDoc", ->
		describe "successfully", ->
			beforeEach ->
				@RedisManager.removeDocFromMemory = sinon.stub().callsArg(2)
				@DocumentManager.flushDocIfLoaded = sinon.stub().callsArgWith(2)
				@HistoryManager.flushDocChanges = sinon.stub().callsArg(2)
				@DocumentManager.flushAndDeleteDoc @project_id, @doc_id, @callback
			
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
			
			it "should flush to track changes", ->
				@HistoryManager.flushDocChanges
					.calledWith(@project_id, @doc_id)
					.should.equal true
	
	describe "flushDocIfLoaded", ->
		describe "when the doc is in Redis", ->
			beforeEach ->
				@RedisManager.getDoc = sinon.stub().callsArgWith(2, null, @lines, @version, @track_changes_on, @track_changes_entries)
				@PersistenceManager.setDoc = sinon.stub().yields()
				@DocumentManager.flushDocIfLoaded @project_id, @doc_id, @callback

			it "should get the doc from redis", ->
				@RedisManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should write the doc lines to the persistence layer", ->
				@PersistenceManager.setDoc
					.calledWith(@project_id, @doc_id, @lines, @version, @track_changes_on, @track_changes_entries)
					.should.equal true
			
			it "should call the callback without error", ->
				@callback.calledWith(null).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when the document is not in Redis", ->
			beforeEach ->
				@RedisManager.getDoc = sinon.stub().callsArgWith(2, null, null, null, null, null)
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
				@DocumentManager.getDoc = sinon.stub().callsArgWith(2, null, @lines, @version, @track_changes_on, @track_changes_entries)
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
				@callback.calledWith(null, @lines, @version, @ops).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

		describe "with no previous version specified", ->
			beforeEach ->
				@DocumentManager.getDoc = sinon.stub().callsArgWith(2, null, @lines, @version, @track_changes_on, @track_changes_entries)
				@RedisManager.getPreviousDocOps = sinon.stub().callsArgWith(3, null, @ops)
				@DocumentManager.getDocAndRecentOps @project_id, @doc_id, -1, @callback

			it "should get the doc", ->
				@DocumentManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should not need to get the doc ops", ->
				@RedisManager.getPreviousDocOps.called.should.equal false

			it "should call the callback with the doc info", ->
				@callback.calledWith(null, @lines, @version, []).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true
	
	describe "getDoc", ->
		describe "when the doc exists in Redis", ->
			beforeEach ->
				@RedisManager.getDoc = sinon.stub().callsArgWith(2, null, @lines, @version, @track_changes_on, @track_changes_entries)
				@DocumentManager.getDoc @project_id, @doc_id, @callback

			it "should get the doc from Redis", ->
				@RedisManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true
			
			it "should call the callback with the doc info", ->
				@callback.calledWith(null, @lines, @version, @track_changes_on, @track_changes_entries, true).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true

		describe "when the doc does not exist in Redis", ->
			beforeEach ->
				@RedisManager.getDoc = sinon.stub().callsArgWith(2, null, null, null, null, null)
				@PersistenceManager.getDoc = sinon.stub().callsArgWith(2, null, @lines, @version, @track_changes_on, @track_changes_entries)
				@RedisManager.putDocInMemory = sinon.stub().yields()
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
					.calledWith(@project_id, @doc_id, @lines, @version, @track_changes_on, @track_changes_entries)
					.should.equal true

			it "should call the callback with the doc info", ->
				@callback.calledWith(null, @lines, @version, @track_changes_on, @track_changes_entries, false).should.equal true

			it "should time the execution", ->
				@Metrics.Timer::done.called.should.equal true
	
	describe "setDoc", ->
		describe "with plain tex lines", ->
			beforeEach ->
				@beforeLines = ["before", "lines"]
				@afterLines = ["after", "lines"]
				@DocumentManager.getDoc = sinon.stub().callsArgWith(2, null, @beforeLines, @version, @track_changes_on, @track_changes_entries, true)
				@DiffCodec.diffAsShareJsOp = sinon.stub().callsArgWith(2, null, @ops)
				@UpdateManager.applyUpdate = sinon.stub().callsArgWith(3, null)
				@DocumentManager.flushDocIfLoaded = sinon.stub().callsArg(2)
				@DocumentManager.flushAndDeleteDoc = sinon.stub().callsArg(2)

			describe "when already loaded", ->
				beforeEach ->
					@DocumentManager.setDoc @project_id, @doc_id, @afterLines, @source, @user_id, @callback

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
				
				it "should call the callback", ->
					@callback.calledWith(null).should.equal true

				it "should time the execution", ->
					@Metrics.Timer::done.called.should.equal true
			
			describe "when not already loaded", ->
				beforeEach ->
					@DocumentManager.getDoc = sinon.stub().callsArgWith(2, null, @beforeLines, @version, false)
					@DocumentManager.setDoc @project_id, @doc_id, @afterLines, @source, @user_id, @callback

				it "should flush and delete the doc from the doc updater", ->
					@DocumentManager.flushAndDeleteDoc
						.calledWith(@project_id, @doc_id)
						.should.equal true

			describe "without new lines", ->
				beforeEach ->
					@DocumentManager.setDoc @project_id, @doc_id, null, @source, @user_id, @callback

				it "should return the callback with an error", ->
					@callback.calledWith(new Error("No lines were passed to setDoc"))
					
				it "should not try to get the doc lines", ->
					@DocumentManager.getDoc.called.should.equal false