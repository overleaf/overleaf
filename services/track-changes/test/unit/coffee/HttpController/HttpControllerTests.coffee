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
			"./UpdatesManager": @UpdatesManager = {}
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
			@UpdatesManager.processUncompressedUpdatesWithLock = sinon.stub().callsArg(1)
			@HttpController.flushUpdatesWithLock @req, @res, @next

		it "should process the updates", ->
			@UpdatesManager.processUncompressedUpdatesWithLock
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

	describe "getUpdates", ->
		beforeEach ->
			@to = Date.now()
			@limit = 10
			@req =
				params:
					doc_id: @doc_id
					project_id: @project_id
				query:
					to:    @to.toString()
					limit: @limit.toString()
			@res =
				send: sinon.stub()
			@rawUpdates = [{
				v:      @v    = 42
				op:     @op   = "mock-op"
				meta:   @meta = "mock-meta"
				doc_id: @doc_id
			}]
			@UpdatesManager.getUpdatesWithUserInfo = sinon.stub().callsArgWith(2, null, @rawUpdates)
			@HttpController.getUpdates @req, @res, @next

		it "should get the updates", ->
			@UpdatesManager.getUpdatesWithUserInfo
				.calledWith(@doc_id, to: @to, limit: @limit)
				.should.equal true

		it "should return the formatted updates", ->
			updates = for update in @rawUpdates
				{
					meta: @meta
					v:    @v
				}
			@res.send.calledWith(JSON.stringify(updates: updates)).should.equal true
