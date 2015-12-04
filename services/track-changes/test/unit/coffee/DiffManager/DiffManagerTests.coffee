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
			"./UpdatesManager": @UpdatesManager = {}
			"./DocumentUpdaterManager": @DocumentUpdaterManager = {}
			"./DiffGenerator": @DiffGenerator = {}
		@callback = sinon.stub()
		@from = new Date()
		@to = new Date(Date.now() + 10000)
		@project_id = "mock-project-id"
		@doc_id = "mock-doc-id"

	describe "getLatestDocAndUpdates", ->
		beforeEach ->
			@content = "hello world"
			@version = 42
			@updates = [ "mock-update-1", "mock-update-2" ]

			@DocumentUpdaterManager.getDocument = sinon.stub().callsArgWith(2, null, @content, @version)
			@UpdatesManager.getDocUpdatesWithUserInfo = sinon.stub().callsArgWith(3, null, @updates)
			@DiffManager.getLatestDocAndUpdates @project_id, @doc_id, @from, @to, @callback

		it "should get the latest version of the doc", ->
			@DocumentUpdaterManager.getDocument
				.calledWith(@project_id, @doc_id)
				.should.equal true

		it "should get the latest updates", ->
			@UpdatesManager.getDocUpdatesWithUserInfo
				.calledWith(@project_id, @doc_id, from: @from, to: @to)
				.should.equal true

		it "should call the callback with the content, version and updates", ->
			@callback.calledWith(null, @content, @version, @updates).should.equal true

	describe "getDiff", ->
		beforeEach ->
			@content = "hello world"
			# Op versions are the version they were applied to, so doc is always one version
			# ahead.s
			@version = 43
			@updates = [
				{ op: "mock-4", v: 42, meta: { start_ts: new Date(@to.getTime() + 20)} }
				{ op: "mock-3", v: 41, meta: { start_ts: new Date(@to.getTime() + 10)} }
				{ op: "mock-2", v: 40, meta: { start_ts: new Date(@to.getTime() - 10)} }
				{ op: "mock-1", v: 39, meta: { start_ts: new Date(@to.getTime() - 20)} }
			]
			@fromVersion = 39
			@toVersion = 40
			@diffed_updates = @updates.slice(2)
			@rewound_content = "rewound-content"
			@diff = [ u: "mock-diff" ]
			
		describe "with matching versions", ->
			beforeEach ->
				@DiffManager.getDocumentBeforeVersion = sinon.stub().callsArgWith(3, null, @rewound_content, @updates)
				@DiffGenerator.buildDiff = sinon.stub().returns(@diff)
				@DiffManager.getDiff @project_id, @doc_id, @fromVersion, @toVersion, @callback

			it "should get the latest doc and version with all recent updates", ->
				@DiffManager.getDocumentBeforeVersion
					.calledWith(@project_id, @doc_id, @fromVersion)
					.should.equal true

			it "should generate the diff", ->
				@DiffGenerator.buildDiff
					.calledWith(@rewound_content, @diffed_updates.slice().reverse())
					.should.equal true

			it "should call the callback with the diff", ->
				@callback.calledWith(null, @diff).should.equal true

		describe "when the updates are inconsistent", ->
			beforeEach ->
				@DiffManager.getLatestDocAndUpdates = sinon.stub().callsArgWith(4, null, @content, @version, @updates)
				@DiffGenerator.buildDiff = sinon.stub().throws(@error = new Error("inconsistent!"))
				@DiffManager.getDiff @project_id, @doc_id, @fromVersion, @toVersion, @callback

			it "should call the callback with an error", ->
				@callback
					.calledWith(@error)
					.should.equal true

	describe "getDocumentBeforeVersion", ->
		beforeEach ->
			@content = "hello world"
			# Op versions are the version they were applied to, so doc is always one version
			# ahead.s
			@version = 43
			@updates = [
				{ op: "mock-4", v: 42, meta: { start_ts: new Date(@to.getTime() + 20)} }
				{ op: "mock-3", v: 41, meta: { start_ts: new Date(@to.getTime() + 10)} }
				{ op: "mock-2", v: 40, meta: { start_ts: new Date(@to.getTime() - 10)} }
				{ op: "mock-1", v: 39, meta: { start_ts: new Date(@to.getTime() - 20)} }
			]
			@fromVersion = 39
			@rewound_content = "rewound-content"
			@diff = [ u: "mock-diff" ]
			
		describe "with matching versions", ->
			beforeEach ->
				@DiffManager.getLatestDocAndUpdates = sinon.stub().callsArgWith(4, null, @content, @version, @updates)
				@DiffGenerator.rewindUpdates = sinon.spy (content, updates) =>
					# the rewindUpdates method reverses the 'updates' array
					updates.reverse()
					return @rewound_content
				@rewindUpdatesWithArgs = @DiffGenerator.rewindUpdates.withArgs(@content, @updates.slice().reverse())
				@DiffManager.getDocumentBeforeVersion @project_id, @doc_id, @fromVersion, @callback

			it "should get the latest doc and version with all recent updates", ->
				@DiffManager.getLatestDocAndUpdates
					.calledWith(@project_id, @doc_id, @fromVersion, null)
					.should.equal true

			it "should rewind the diff", ->
				sinon.assert.calledOnce(@rewindUpdatesWithArgs)

			it "should call the callback with the rewound document and updates", ->
				@callback.calledWith(null, @rewound_content, @updates).should.equal true

		describe "with mismatching versions", ->
			beforeEach ->
				@version = 50
				@updates = [ { op: "mock-1", v: 40 }, { op: "mock-1", v: 39 } ]
				@DiffManager.getLatestDocAndUpdates = sinon.stub().callsArgWith(4, null, @content, @version, @updates)
				@DiffManager.getDocumentBeforeVersion @project_id, @doc_id, @fromVersion, @callback

			it "should call the callback with an error", ->
				@callback
					.calledWith(new Error("latest update version, 40, does not match doc version, 42"))
					.should.equal true

		describe "when the updates are inconsistent", ->
			beforeEach ->
				@DiffManager.getLatestDocAndUpdates = sinon.stub().callsArgWith(4, null, @content, @version, @updates)
				@DiffGenerator.rewindUpdates = sinon.stub().throws(@error = new Error("inconsistent!"))
				@DiffManager.getDocumentBeforeVersion @project_id, @doc_id, @fromVersion, @callback

			it "should call the callback with an error", ->
				@callback
					.calledWith(@error)
					.should.equal true
