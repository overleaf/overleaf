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
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
		@res = { send: sinon.stub(), json: sinon.stub() }
		@req = {}
		@next = sinon.stub()
		@project_id = "mock-project-id"
		@doc_id = "mock-doc-id"
		@doc = {
			_id: @doc_id
			lines: ["mock", "lines"]
		}

	describe "getDoc", ->
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
			@res.json
				.calledWith(lines: @doc.lines)
				.should.equal true

	describe "updateDoc", ->
		beforeEach ->
			@req.params =
				project_id: @project_id
				doc_id: @doc_id

		describe "when the doc lines exist and were updated", ->
			beforeEach ->
				@req.body =
					lines: @lines = ["hello", "world"]
				@DocManager.updateDoc = sinon.stub().callsArgWith(3, null, true)
				@HttpController.updateDoc @req, @res, @next

			it "should update the document", ->
				@DocManager.updateDoc
					.calledWith(@project_id, @doc_id, @lines)
					.should.equal true

			it "should return a modified status", ->
				@res.json
					.calledWith(modified: true)
					.should.equal true

		describe "when the doc lines exist and were not updated", ->
			beforeEach ->
				@req.body =
					lines: @lines = ["hello", "world"]
				@DocManager.updateDoc = sinon.stub().callsArgWith(3, null, false)
				@HttpController.updateDoc @req, @res, @next

			it "should return a modified status", ->
				@res.json
					.calledWith(modified: false)
					.should.equal true

		describe "when the doc lines are not provided", ->
			beforeEach ->
				@req.body = {}
				@DocManager.updateDoc = sinon.stub().callsArgWith(3, null, false)
				@HttpController.updateDoc @req, @res, @next

			it "should not update the document", ->
				@DocManager.updateDoc.called.should.equal false

			it "should return a 400 (bad request) response", ->
				@res.send
					.calledWith(400)
					.should.equal true
