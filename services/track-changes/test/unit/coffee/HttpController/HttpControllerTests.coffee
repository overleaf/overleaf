sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/HttpController.js"
SandboxedModule = require('sandboxed-module')

describe "HttpController", ->
	beforeEach ->
		@HttpController = SandboxedModule.require modulePath, requires:
			"logger-sharelatex": { log: sinon.stub() }
			"./HistoryManager": @HistoryManager = {}
		@doc_id = "doc-id-123"
		@version = 42
		@next = sinon.stub()

	describe "appendUpdates", ->
		beforeEach ->
			@req =
				params:
					doc_id: @doc_id
				body:
					docOps: @docOps = ["mock-ops"]
					version: @version
			@res =
				send: sinon.stub()
			@HistoryManager.compressAndSaveRawUpdates = sinon.stub().callsArg(2)
			@HttpController.appendUpdates @req, @res, @next

		it "should append the updates", ->
			@HistoryManager.compressAndSaveRawUpdates
				.calledWith(@doc_id, @docOps)
				.should.equal true

		it "should return a success code", ->
			@res.send.calledWith(204).should.equal true