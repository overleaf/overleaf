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
			"./DiffManager": @DiffManager = {}
		@doc_id = "doc-id-123"
		@project_id = "project-id-123"
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

	describe "getDiff", ->
		beforeEach ->
			@from = Date.now() - 10000
			@to = Date.now()
			@req =
				params:
					doc_id: @doc_id
					project_id: @project_id
				query:
					from: @from.toString()
					to: @to.toString()
			@res =
				send: sinon.stub()
			@diff = [ u: "mock-diff" ]
			@DiffManager.getDiff = sinon.stub().callsArgWith(4, null, @diff)
			@HttpController.getDiff @req, @res, @next

		it "should get the diff", ->
			@DiffManager.getDiff
				.calledWith(@project_id, @doc_id, parseInt(@from, 10), parseInt(@to, 10))
				.should.equal true

		it "should return the diff", ->
			@res.send.calledWith(JSON.stringify(diff: @diff)).should.equal true
