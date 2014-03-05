sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/DiffManager.js"
SandboxedModule = require('sandboxed-module')

describe "DiffManager", ->
	beforeEach ->
		@DiffManager = SandboxedModule.require modulePath, requires:
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
			"./HistoryManager": @HistoryManager = {}
			"./DocumentUpdaterManager": @DocumentUpdaterManager = {}
			"./MongoManager": @MongoManager = {}
			"./DiffGenerator": @DiffGenerator = {}
		@callback = sinon.stub()
		@from = new Date()
		@to = new Date(Date.now() + 10000)
		@project_id = "mock-project-id"
		@doc_id = "mock-doc-id"

	describe "getLatestDocAndUpdates", ->
		beforeEach ->
			@lines = [ "hello", "world" ]
			@version = 42
			@updates = [ "mock-update-1", "mock-update-2" ]

			@HistoryManager.processUncompressedUpdatesWithLock = sinon.stub().callsArg(1)
			@DocumentUpdaterManager.getDocument = sinon.stub().callsArgWith(2, null, @lines, @version)
			@MongoManager.getUpdatesBetweenDates = sinon.stub().callsArgWith(2, null, @updates)
			@DiffManager.getLatestDocAndUpdates @project_id, @doc_id, @from, @to, @callback

		it "should ensure the latest updates have been compressed", ->
			@HistoryManager.processUncompressedUpdatesWithLock
				.calledWith(@doc_id)
				.should.equal true

		it "should get the latest version of the doc", ->
			@DocumentUpdaterManager.getDocument
				.calledWith(@project_id, @doc_id)
				.should.equal true

		it "should get the requested updates from Mongo", ->
			@MongoManager.getUpdatesBetweenDates
				.calledWith(@doc_id, from: @from, to: @to)
				.should.equal true

		it "should call the callback with the lines, version and updates", ->
			@callback.calledWith(null, @lines, @version, @updates).should.equal true

	describe "getDiff", ->
		beforeEach ->
			@lines = [ "hello", "world" ]
			@version = 42
			@updates = [
				{ op: "mock-4", v: 42, meta: { start_ts: new Date(@to.getTime() + 20)} }
				{ op: "mock-3", v: 41, meta: { start_ts: new Date(@to.getTime() + 10)} }
				{ op: "mock-2", v: 40, meta: { start_ts: new Date(@to.getTime() - 10)} }
				{ op: "mock-1", v: 39, meta: { start_ts: new Date(@to.getTime() - 20)} }
			]
			@diffed_updates = @updates.slice(2)
			@rewound_content = "rewound-content"
			@diff = [ u: "mock-diff" ]
			
		describe "with matching versions", ->
			beforeEach ->
				@DiffManager.getLatestDocAndUpdates = sinon.stub().callsArgWith(4, null, @lines, @version, @updates)
				@DiffGenerator.rewindUpdates = sinon.stub().returns(@rewound_content)
				@DiffGenerator.buildDiff = sinon.stub().returns(@diff)
				@DiffManager.getDiff @project_id, @doc_id, @from, @to, @callback

			it "should get the latest doc and version with all recent updates", ->
				@DiffManager.getLatestDocAndUpdates
					.calledWith(@project_id, @doc_id, @from, null)
					.should.equal true

			it "should rewind the diff", ->
				@DiffGenerator.rewindUpdates
					.calledWith(@lines.join("\n"), @updates)
					.should.equal true

			it "should generate the diff", ->
				@DiffGenerator.buildDiff
					.calledWith(@rewound_content, @diffed_updates.reverse())
					.should.equal true

			it "should call the callback with the diff", ->
				@callback.calledWith(null, @diff).should.equal true

		describe "with mismatching versions", ->
			beforeEach ->
				@version = 42
				@updates = [ { op: "mock-1", v: 40 }, { op: "mock-1", v: 39 } ]
				@DiffManager.getLatestDocAndUpdates = sinon.stub().callsArgWith(4, null, @lines, @version, @updates)
				@DiffManager.getDiff @project_id, @doc_id, @from, @to, @callback

			it "should call the callback with an error", ->
				@callback
					.calledWith(new Error("latest update version, 40, does not match doc version, 42"))
					.should.equal true

		describe "when the updates are inconsistent", ->
			beforeEach ->
				@DiffManager.getLatestDocAndUpdates = sinon.stub().callsArgWith(4, null, @lines, @version, @updates)
				@DiffGenerator.rewindUpdates = sinon.stub().throws(@error = new Error("inconsistent!"))
				@DiffManager.getDiff @project_id, @doc_id, @from, @to, @callback

			it "should call the callback with an error", ->
				@callback
					.calledWith(@error)
					.should.equal true

