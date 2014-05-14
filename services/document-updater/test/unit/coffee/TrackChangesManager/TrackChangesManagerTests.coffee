SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../../app/js/TrackChangesManager'

describe "TrackChangesManager", ->
	beforeEach ->
		@TrackChangesManager = SandboxedModule.require modulePath, requires:
			"request": @request = {}
			"settings-sharelatex": @Settings = {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
			"./RedisManager": @RedisManager = {}
		@project_id = "mock-project-id"
		@doc_id = "mock-doc-id"
		@callback = sinon.stub()

	describe "flushDocChanges", ->
		beforeEach ->
			@Settings.apis =
				trackchanges: url: "http://trackchanges.example.com"

		describe "successfully", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, statusCode: 204)
				@TrackChangesManager.flushDocChanges @project_id, @doc_id, @callback

			it "should send a request to the track changes api", ->
				@request.post
					.calledWith("#{@Settings.apis.trackchanges.url}/project/#{@project_id}/doc/#{@doc_id}/flush")
					.should.equal true

			it "should return the callback", ->
				@callback.calledWith(null).should.equal true

		describe "when the track changes api returns an error", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, statusCode: 500)
				@TrackChangesManager.flushDocChanges @project_id, @doc_id, @callback

			it "should return the callback with an error", ->
				@callback.calledWith(new Error("track changes api return non-success code: 500")).should.equal true

	describe "pushUncompressedHistoryOp", ->
		beforeEach ->
			@op = "mock-op"
			@TrackChangesManager.flushDocChanges = sinon.stub().callsArg(2)

		describe "pushing the op", ->
			beforeEach ->
				@RedisManager.pushUncompressedHistoryOp = sinon.stub().callsArgWith(3, null, 1)
				@TrackChangesManager.pushUncompressedHistoryOp @project_id, @doc_id, @op, @callback

			it "should push the op into redis", ->
				@RedisManager.pushUncompressedHistoryOp
					.calledWith(@project_id, @doc_id, @op)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

			it "should not try to flush the op", ->
				@TrackChangesManager.flushDocChanges.called.should.equal false

		describe "when there are a multiple of FLUSH_EVERY_N_OPS ops", ->
			beforeEach ->
				@RedisManager.pushUncompressedHistoryOp =
					sinon.stub().callsArgWith(3, null, 2 * @TrackChangesManager.FLUSH_EVERY_N_OPS)
				@TrackChangesManager.pushUncompressedHistoryOp @project_id, @doc_id, @op, @callback

			it "should tell the track changes api to flush", ->
				@TrackChangesManager.flushDocChanges
					.calledWith(@project_id, @doc_id)
					.should.equal true

		describe "when TrackChangesManager errors", ->
			beforeEach ->
				@RedisManager.pushUncompressedHistoryOp =
					sinon.stub().callsArgWith(3, null, 2 * @TrackChangesManager.FLUSH_EVERY_N_OPS)
				@TrackChangesManager.flushDocChanges = sinon.stub().callsArgWith(2, @error = new Error("oops"))
				@TrackChangesManager.pushUncompressedHistoryOp @project_id, @doc_id, @op, @callback

			it "should log out the error", ->
				@logger.error
					.calledWith(
						err: @error
						doc_id: @doc_id
						project_id: @project_id
						"error flushing doc to track changes api"
					)
					.should.equal true


