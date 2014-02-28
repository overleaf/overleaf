SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../../app/js/TrackChangesManager'

describe "TrackChangesManager", ->
	beforeEach ->
		@TrackChangesManager = SandboxedModule.require modulePath, requires:
			"request": @request = {}
			"settings-sharelatex": @Settings = {}
			"logger-sharelatex": @logger = { log: sinon.stub() }
			"./RedisManager": @RedisManager = {}
		@doc_id = "mock-doc-id"
		@callback = sinon.stub()

	describe "flushDocChanges", ->
		beforeEach ->
			@Settings.apis =
				trackchanges: url: "http://trackchanges.example.com"

		describe "successfully", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, statusCode: 204)
				@TrackChangesManager.flushDocChanges @doc_id, @callback

			it "should send a request to the track changes api", ->
				@request.post
					.calledWith("#{@Settings.apis.trackchanges.url}/doc/#{@doc_id}/flush")
					.should.equal true

			it "should return the callback", ->
				@callback.calledWith(null).should.equal true

		describe "when the track changes api returns an error", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, statusCode: 500)
				@TrackChangesManager.flushDocChanges @doc_id, @callback

			it "should return the callback with an error", ->
				@callback.calledWith(new Error("track changes api return non-success code: 500")).should.equal true

	describe "pushUncompressedHistoryOp", ->
		beforeEach ->
			@op = "mock-op"
			@TrackChangesManager.flushDocChanges = sinon.stub().callsArg(1)

		describe "pushing the op", ->
			beforeEach ->
				@RedisManager.pushUncompressedHistoryOp = sinon.stub().callsArgWith(2, null, 1)
				@TrackChangesManager.pushUncompressedHistoryOp @doc_id, @op, @callback

			it "should push the op into redis", ->
				@RedisManager.pushUncompressedHistoryOp
					.calledWith(@doc_id, @op)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

			it "should not try to flush the op", ->
				@TrackChangesManager.flushDocChanges.called.should.equal false

		describe "when there are a multiple of FLUSH_EVERY_N_OPS ops", ->
			beforeEach ->
				@RedisManager.pushUncompressedHistoryOp =
					sinon.stub().callsArgWith(2, null, 2 * @TrackChangesManager.FLUSH_EVERY_N_OPS)
				@TrackChangesManager.pushUncompressedHistoryOp @doc_id, @op, @callback

			it "should tell the track changes api to flush", ->
				@TrackChangesManager.flushDocChanges
					.calledWith(@doc_id)
					.should.equal true

