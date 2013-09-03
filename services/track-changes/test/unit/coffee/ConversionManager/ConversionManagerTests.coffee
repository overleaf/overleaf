sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/ConversionManager.js"
SandboxedModule = require('sandboxed-module')

describe "ConversionManager", ->
	beforeEach ->
		@ConversionManager = SandboxedModule.require modulePath, requires:
			"./HistoryBuilder": @HistoryBuilder = {}
			"./mongojs" : {}
			"logger-sharelatex": { log: sinon.stub() }
		@doc_id = "doc-id-123"
		@callback = sinon.stub()

	describe "when there are no raw ops", ->
		beforeEach ->
			@ConversionManager.popLastCompressedOp = sinon.stub()
			@ConversionManager.insertCompressedOps = sinon.stub()
			@ConversionManager.convertAndSaveRawOps @doc_id, [], @callback

		it "should not need to access the database", ->
			@ConversionManager.popLastCompressedOp.called.should.equal false
			@ConversionManager.insertCompressedOps.called.should.equal false

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "when there is no compressed history to begin with", ->
		beforeEach ->
			@rawOps = ["mock-raw-op-1", "mock-raw-op-2"]
			@compressedOps = ["mock-compressed-op"]

			@ConversionManager.popLastCompressedOp = sinon.stub().callsArgWith(1, null, null)
			@ConversionManager.insertCompressedOps = sinon.stub().callsArg(2)
			@HistoryBuilder.compressOps = sinon.stub().returns(@compressedOps)
			@ConversionManager.convertAndSaveRawOps @doc_id, @rawOps, @callback

		it "should try to pop the last compressed op", ->
			@ConversionManager.popLastCompressedOp
				.calledWith(@doc_id)
				.should.equal true
		
		it "should compress the raw ops", ->
			@HistoryBuilder.compressOps
				.calledWith(@rawOps)
				.should.equal true
		
		it "should save the compressed ops", ->
			@ConversionManager.insertCompressedOps
				.calledWith(@doc_id, @compressedOps)
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "when the raw ops need appending to existing history", ->
		beforeEach ->
			@rawOps = ["mock-raw-op-1", "mock-raw-op-2"]
			@lastCompressedOp = "mock-last-compressed-op-0"
			@compressedOps = ["mock-compressed-op-1"]

			@ConversionManager.popLastCompressedOp = sinon.stub().callsArgWith(1, null, @lastCompressedOp)
			@ConversionManager.insertCompressedOps = sinon.stub().callsArg(2)
			@HistoryBuilder.compressOps = sinon.stub().returns(@compressedOps)
			@ConversionManager.convertAndSaveRawOps @doc_id, @rawOps, @callback

		it "should try to pop the last compressed op", ->
			@ConversionManager.popLastCompressedOp
				.calledWith(@doc_id)
				.should.equal true
		
		it "should compress the last compressed op and the raw ops", ->
			@HistoryBuilder.compressOps
				.calledWith([@lastCompressedOp].concat(@rawOps))
				.should.equal true
		
		it "should save the compressed ops", ->
			@ConversionManager.insertCompressedOps
				.calledWith(@doc_id, @compressedOps)
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true
		

