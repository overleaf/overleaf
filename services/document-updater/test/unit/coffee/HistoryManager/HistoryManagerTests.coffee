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
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
			"./HistoryRedisManager": @HistoryRedisManager = {}
		@project_id = "mock-project-id"
		@doc_id = "mock-doc-id"
		@callback = sinon.stub()

	describe "flushChangesAsync", ->
		beforeEach ->
			@HistoryManager._flushDocChangesAsync = sinon.stub()
			@HistoryManager._flushProjectChangesAsync = sinon.stub()

			@HistoryManager.flushChangesAsync(@project_id, @doc_id)

		it "flushes doc changes", ->
			@HistoryManager._flushDocChangesAsync
				.calledWith(@project_id, @doc_id)
				.should.equal true

		it "flushes project changes", ->
			@HistoryManager._flushProjectChangesAsync
				.calledWith(@project_id)
				.should.equal true

	describe "_flushDocChangesAsync", ->
		beforeEach ->
			@request.post = sinon.stub().callsArgWith(1, null, statusCode: 204)

			@HistoryManager._flushDocChangesAsync @project_id, @doc_id

		it "should send a request to the track changes api", ->
			@request.post
				.calledWith("#{@Settings.apis.trackchanges.url}/project/#{@project_id}/doc/#{@doc_id}/flush")
				.should.equal true

	describe "_flushProjectChangesAsync", ->
		beforeEach ->
			@request.post = sinon.stub().callsArgWith(1, null, statusCode: 204)

			@HistoryManager._flushProjectChangesAsync @project_id

		it "should send a request to the project history api", ->
			@request.post
				.calledWith("#{@Settings.apis.project_history.url}/project/#{@project_id}/flush")
				.should.equal true

	describe "recordAndFlushHistoryOps", ->
		beforeEach ->
			@ops = [ 'mock-ops' ]
			@project_ops_length = 10
			@doc_ops_length = 5

			@HistoryManager._flushProjectChangesAsync = sinon.stub()
			@HistoryRedisManager.recordDocHasHistoryOps = sinon.stub().callsArg(3)
			@HistoryManager._flushDocChangesAsync = sinon.stub()

		describe "with no ops", ->
			beforeEach ->
				@HistoryManager.recordAndFlushHistoryOps(
					@project_id, @doc_id, [], @doc_ops_length, @project_ops_length, @callback
				)

			it "should not flush project changes", ->
				@HistoryManager._flushProjectChangesAsync.called.should.equal false

			it "should not record doc has history ops", ->
				@HistoryRedisManager.recordDocHasHistoryOps.called.should.equal false

			it "should not flush doc changes", ->
				@HistoryManager._flushDocChangesAsync.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "with enough ops to flush project changes", ->
			beforeEach ->
				@HistoryManager._shouldFlushHistoryOps = sinon.stub()
				@HistoryManager._shouldFlushHistoryOps.withArgs(@project_ops_length).returns(true)
				@HistoryManager._shouldFlushHistoryOps.withArgs(@doc_ops_length).returns(false)

				@HistoryManager.recordAndFlushHistoryOps(
					@project_id, @doc_id, @ops, @doc_ops_length, @project_ops_length, @callback
				)

			it "should flush project changes", ->
				@HistoryManager._flushProjectChangesAsync
					.calledWith(@project_id)
					.should.equal true

			it "should record doc has history ops", ->
				@HistoryRedisManager.recordDocHasHistoryOps
					.calledWith(@project_id, @doc_id, @ops)

			it "should not flush doc changes", ->
				@HistoryManager._flushDocChangesAsync.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "with enough ops to flush doc changes", ->
			beforeEach ->
				@HistoryManager._shouldFlushHistoryOps = sinon.stub()
				@HistoryManager._shouldFlushHistoryOps.withArgs(@project_ops_length).returns(false)
				@HistoryManager._shouldFlushHistoryOps.withArgs(@doc_ops_length).returns(true)

				@HistoryManager.recordAndFlushHistoryOps(
					@project_id, @doc_id, @ops, @doc_ops_length, @project_ops_length, @callback
				)

			it "should not flush project changes", ->
				@HistoryManager._flushProjectChangesAsync.called.should.equal false

			it "should record doc has history ops", ->
				@HistoryRedisManager.recordDocHasHistoryOps
					.calledWith(@project_id, @doc_id, @ops)

			it "should flush doc changes", ->
				@HistoryManager._flushDocChangesAsync
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
				@HistoryManager._flushDocChangesAsync.called.should.equal false

			it "should call the callback with the error", ->
				@callback.calledWith(@error).should.equal true

		describe "_shouldFlushHistoryOps", ->
			it "should return false if the number of ops is not known", ->
				@HistoryManager._shouldFlushHistoryOps(null, ['a', 'b', 'c'], 1).should.equal false

			it "should return false if the updates didn't take us past the threshold", ->
				# Currently there are 14 ops
				# Previously we were on 11 ops
				# We didn't pass over a multiple of 5
				@HistoryManager._shouldFlushHistoryOps(14, ['a', 'b', 'c'], 5).should.equal false

		  it "should return true if the updates took to the threshold", ->
				# Currently there are 15 ops
				# Previously we were on 12 ops
				# We've reached a new multiple of 5
				@HistoryManager._shouldFlushHistoryOps(15, ['a', 'b', 'c'], 5).should.equal true

			it "should return true if the updates took past the threshold", ->
				# Currently there are 19 ops
				# Previously we were on 16 ops
				# We didn't pass over a multiple of 5
				@HistoryManager._shouldFlushHistoryOps(17, ['a', 'b', 'c'], 5).should.equal true
