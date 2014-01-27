sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/HistoryManager.js"
SandboxedModule = require('sandboxed-module')

describe "HistoryManager", ->
	beforeEach ->
		@HistoryManager = SandboxedModule.require modulePath, requires:
			"./UpdateCompressor": @UpdateCompressor = {}
			"./mongojs" : {}
			"logger-sharelatex": { log: sinon.stub() }
		@doc_id = "doc-id-123"
		@callback = sinon.stub()

	describe "when there are no raw ops", ->
		beforeEach ->
			@HistoryManager.popLastCompressedUpdate = sinon.stub()
			@HistoryManager.insertCompressedUpdates = sinon.stub()
			@HistoryManager.compressAndSaveRawUpdates @doc_id, [], @callback

		it "should not need to access the database", ->
			@HistoryManager.popLastCompressedUpdate.called.should.equal false
			@HistoryManager.insertCompressedUpdates.called.should.equal false

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "when there is no compressed history to begin with", ->
		beforeEach ->
			@rawUpdates = ["mock-raw-op-1", "mock-raw-op-2"]
			@compressedUpdates = ["mock-compressed-op"]

			@HistoryManager.popLastCompressedUpdate = sinon.stub().callsArgWith(1, null, null)
			@HistoryManager.insertCompressedUpdates = sinon.stub().callsArg(2)
			@UpdateCompressor.compressRawUpdates = sinon.stub().returns(@compressedUpdates)
			@HistoryManager.compressAndSaveRawUpdates @doc_id, @rawUpdates, @callback

		it "should try to pop the last compressed op", ->
			@HistoryManager.popLastCompressedUpdate
				.calledWith(@doc_id)
				.should.equal true
		
		it "should compress the raw ops", ->
			@UpdateCompressor.compressRawUpdates
				.calledWith(null, @rawUpdates)
				.should.equal true
		
		it "should save the compressed ops", ->
			@HistoryManager.insertCompressedUpdates
				.calledWith(@doc_id, @compressedUpdates)
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "when the raw ops need appending to existing history", ->
		beforeEach ->
			@rawUpdates = ["mock-raw-op-1", "mock-raw-op-2"]
			@lastCompressedUpdate = "mock-last-compressed-op-0"
			@compressedUpdates = ["mock-compressed-op-1"]

			@HistoryManager.popLastCompressedUpdate = sinon.stub().callsArgWith(1, null, @lastCompressedUpdate)
			@HistoryManager.insertCompressedUpdates = sinon.stub().callsArg(2)
			@UpdateCompressor.compressRawUpdates = sinon.stub().returns(@compressedUpdates)
			@HistoryManager.compressAndSaveRawUpdates @doc_id, @rawUpdates, @callback

		it "should try to pop the last compressed op", ->
			@HistoryManager.popLastCompressedUpdate
				.calledWith(@doc_id)
				.should.equal true
		
		it "should compress the last compressed op and the raw ops", ->
			@UpdateCompressor.compressRawUpdates
				.calledWith(@lastCompressedUpdate, @rawUpdates)
				.should.equal true
		
		it "should save the compressed ops", ->
			@HistoryManager.insertCompressedUpdates
				.calledWith(@doc_id, @compressedUpdates)
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true
		

