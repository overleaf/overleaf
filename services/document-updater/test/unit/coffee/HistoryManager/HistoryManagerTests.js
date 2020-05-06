SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../../app/js/HistoryManager'

describe "HistoryManager", ->
	beforeEach ->
		@HistoryManager = SandboxedModule.require modulePath, requires:
			"request": @request = {}
			"settings-sharelatex": @Settings = {
				apis:
					project_history:
						enabled: true
						url: "http://project_history.example.com"
					trackchanges:
						url: "http://trackchanges.example.com"
			}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub(), debug: sinon.stub() }
			"./DocumentManager": @DocumentManager = {}
			"./HistoryRedisManager": @HistoryRedisManager = {}
			"./RedisManager": @RedisManager = {}
			"./ProjectHistoryRedisManager": @ProjectHistoryRedisManager = {}
			"./Metrics": @metrics = {inc: sinon.stub()}
		@project_id = "mock-project-id"
		@doc_id = "mock-doc-id"
		@callback = sinon.stub()

	describe "flushDocChangesAsync", ->
		beforeEach ->
			@request.post = sinon.stub().callsArgWith(1, null, statusCode: 204)

		describe "when the project uses track changes", ->
			beforeEach ->
				@RedisManager.getHistoryType = sinon.stub().yields(null, 'track-changes')
				@HistoryManager.flushDocChangesAsync @project_id, @doc_id

			it "should send a request to the track changes api", ->
				@request.post
					.calledWith("#{@Settings.apis.trackchanges.url}/project/#{@project_id}/doc/#{@doc_id}/flush")
					.should.equal true

		describe "when the project uses project history and double flush is not disabled", ->
			beforeEach ->
				@RedisManager.getHistoryType = sinon.stub().yields(null, 'project-history')
				@HistoryManager.flushDocChangesAsync @project_id, @doc_id

			it "should send a request to the track changes api", ->
				@request.post
					.called
					.should.equal true

		describe "when the project uses project history and double flush is disabled", ->
			beforeEach ->
				@Settings.disableDoubleFlush = true
				@RedisManager.getHistoryType = sinon.stub().yields(null, 'project-history')
				@HistoryManager.flushDocChangesAsync @project_id, @doc_id

			it "should not send a request to the track changes api", ->
				@request.post
					.called
					.should.equal false


	describe "flushProjectChangesAsync", ->
		beforeEach ->
			@request.post = sinon.stub().callsArgWith(1, null, statusCode: 204)

			@HistoryManager.flushProjectChangesAsync @project_id

		it "should send a request to the project history api", ->
			@request.post
				.calledWith({url: "#{@Settings.apis.project_history.url}/project/#{@project_id}/flush", qs:{background:true}})
				.should.equal true

	describe "flushProjectChanges", ->

		describe "in the normal case", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, statusCode: 204)
				@HistoryManager.flushProjectChanges @project_id, {background:true}

			it "should send a request to the project history api", ->
				@request.post
					.calledWith({url: "#{@Settings.apis.project_history.url}/project/#{@project_id}/flush", qs:{background:true}})
					.should.equal true

		describe "with the skip_history_flush option", ->
			beforeEach ->
				@request.post = sinon.stub()
				@HistoryManager.flushProjectChanges @project_id, {skip_history_flush:true}

			it "should not send a request to the project history api", ->
				@request.post
					.called
					.should.equal false

	describe "recordAndFlushHistoryOps", ->
		beforeEach ->
			@ops = [ 'mock-ops' ]
			@project_ops_length = 10
			@doc_ops_length = 5

			@HistoryManager.flushProjectChangesAsync = sinon.stub()
			@HistoryRedisManager.recordDocHasHistoryOps = sinon.stub().callsArg(3)
			@HistoryManager.flushDocChangesAsync = sinon.stub()

		describe "with no ops", ->
			beforeEach ->
				@HistoryManager.recordAndFlushHistoryOps(
					@project_id, @doc_id, [], @doc_ops_length, @project_ops_length, @callback
				)

			it "should not flush project changes", ->
				@HistoryManager.flushProjectChangesAsync.called.should.equal false

			it "should not record doc has history ops", ->
				@HistoryRedisManager.recordDocHasHistoryOps.called.should.equal false

			it "should not flush doc changes", ->
				@HistoryManager.flushDocChangesAsync.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "with enough ops to flush project changes", ->
			beforeEach ->
				@HistoryManager.shouldFlushHistoryOps = sinon.stub()
				@HistoryManager.shouldFlushHistoryOps.withArgs(@project_ops_length).returns(true)
				@HistoryManager.shouldFlushHistoryOps.withArgs(@doc_ops_length).returns(false)

				@HistoryManager.recordAndFlushHistoryOps(
					@project_id, @doc_id, @ops, @doc_ops_length, @project_ops_length, @callback
				)

			it "should flush project changes", ->
				@HistoryManager.flushProjectChangesAsync
					.calledWith(@project_id)
					.should.equal true

			it "should record doc has history ops", ->
				@HistoryRedisManager.recordDocHasHistoryOps
					.calledWith(@project_id, @doc_id, @ops)

			it "should not flush doc changes", ->
				@HistoryManager.flushDocChangesAsync.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "with enough ops to flush doc changes", ->
			beforeEach ->
				@HistoryManager.shouldFlushHistoryOps = sinon.stub()
				@HistoryManager.shouldFlushHistoryOps.withArgs(@project_ops_length).returns(false)
				@HistoryManager.shouldFlushHistoryOps.withArgs(@doc_ops_length).returns(true)

				@HistoryManager.recordAndFlushHistoryOps(
					@project_id, @doc_id, @ops, @doc_ops_length, @project_ops_length, @callback
				)

			it "should not flush project changes", ->
				@HistoryManager.flushProjectChangesAsync.called.should.equal false

			it "should record doc has history ops", ->
				@HistoryRedisManager.recordDocHasHistoryOps
					.calledWith(@project_id, @doc_id, @ops)

			it "should flush doc changes", ->
				@HistoryManager.flushDocChangesAsync
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when recording doc has history ops errors", ->
			beforeEach ->
				@error = new Error("error")
				@HistoryRedisManager.recordDocHasHistoryOps =
					sinon.stub().callsArgWith(3, @error)

				@HistoryManager.recordAndFlushHistoryOps(
					@project_id, @doc_id, @ops, @doc_ops_length, @project_ops_length, @callback
				)

			it "should not flush doc changes", ->
				@HistoryManager.flushDocChangesAsync.called.should.equal false

			it "should call the callback with the error", ->
				@callback.calledWith(@error).should.equal true

		describe "shouldFlushHistoryOps", ->
			it "should return false if the number of ops is not known", ->
				@HistoryManager.shouldFlushHistoryOps(null, ['a', 'b', 'c'].length, 1).should.equal false

			it "should return false if the updates didn't take us past the threshold", ->
				# Currently there are 14 ops
				# Previously we were on 11 ops
				# We didn't pass over a multiple of 5
				@HistoryManager.shouldFlushHistoryOps(14, ['a', 'b', 'c'].length, 5).should.equal false

		  it "should return true if the updates took to the threshold", ->
				# Currently there are 15 ops
				# Previously we were on 12 ops
				# We've reached a new multiple of 5
				@HistoryManager.shouldFlushHistoryOps(15, ['a', 'b', 'c'].length, 5).should.equal true

			it "should return true if the updates took past the threshold", ->
				# Currently there are 19 ops
				# Previously we were on 16 ops
				# We didn't pass over a multiple of 5
				@HistoryManager.shouldFlushHistoryOps(17, ['a', 'b', 'c'].length, 5).should.equal true

	describe "resyncProjectHistory", ->
		beforeEach ->
			@projectHistoryId = 'history-id-1234'
			@docs = [
				doc: @doc_id
				path: 'main.tex'
			]
			@files = [
				file: 'mock-file-id'
				path: 'universe.png'
				url: "www.filestore.test/#{@project_id}/mock-file-id"
			]
			@ProjectHistoryRedisManager.queueResyncProjectStructure = sinon.stub().yields()
			@DocumentManager.resyncDocContentsWithLock = sinon.stub().yields()
			@HistoryManager.resyncProjectHistory @project_id, @projectHistoryId, @docs, @files, @callback

		it "should queue a project structure reync", ->
			@ProjectHistoryRedisManager.queueResyncProjectStructure
				.calledWith(@project_id, @projectHistoryId, @docs, @files)
				.should.equal true

		it "should queue doc content reyncs", ->
			@DocumentManager
				.resyncDocContentsWithLock
				.calledWith(@project_id, @doc_id)
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true
