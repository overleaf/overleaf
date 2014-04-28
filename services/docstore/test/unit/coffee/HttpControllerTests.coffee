SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
chai = require('chai')
chai.should()
expect = chai.expect
modulePath = require('path').join __dirname, '../../../app/js/HttpController'

describe "HttpController", ->
	beforeEach ->
		@HttpController = SandboxedModule.require modulePath, requires:
			"./DocManager": @DocManager = {}
			"logger-sharelatex": @logger = { log: sinon.stub() }
		@res = { send: sinon.stub() }
		@req = {}
		@next = sinon.stub()
		@project_id = "mock-project-id"
		@doc_id = "mock-doc-id"
		@doc = {
			_id: @doc_id
			lines: ["mock", "lines"]
		}

	describe "getDoc", ->
		describe "when the doc exists", ->
			beforeEach ->
				@req.params =
					project_id: @project_id
					doc_id: @doc_id
				@DocManager.getDoc = sinon.stub().callsArgWith(2, null, @doc)
				@HttpController.getDoc @req, @res, @next

			it "should get the document", ->
				@DocManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should return the doc as JSON", ->
				@res.send
					.calledWith(JSON.stringify(lines: @doc.lines))
					.should.equal true

		describe "when the doc does not exist", ->
			beforeEach ->
				@req.params =
					project_id: @project_id
					doc_id: @doc_id
				@DocManager.getDoc = sinon.stub().callsArgWith(2, null, null)
				@HttpController.getDoc @req, @res, @next

			it "should return a 404", ->
				@res.send
					.calledWith(404)
					.should.equal true