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

	describe "flushUpdatesWithLock", ->
		beforeEach ->
			@req =
				params:
					doc_id: @doc_id
			@res =
				send: sinon.stub()
			@HistoryManager.processUncompressedUpdatesWithLock = sinon.stub().callsArg(1)
			@HttpController.flushUpdatesWithLock @req, @res, @next

		it "should process the updates", ->
			@HistoryManager.processUncompressedUpdatesWithLock
				.calledWith(@doc_id)
				.should.equal true

		it "should return a success code", ->
			@res.send.calledWith(204).should.equal true