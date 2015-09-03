sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Documents/DocumentController.js"
SandboxedModule = require('sandboxed-module')
events = require "events"
MockRequest = require "../helpers/MockRequest"
MockResponse = require "../helpers/MockResponse"
Errors = require "../../../../app/js/errors"

describe "DocumentController", ->
	beforeEach ->
		@DocumentController = SandboxedModule.require modulePath, requires:
			"logger-sharelatex":
				log:->
				err:->
			"../Project/ProjectEntityHandler": @ProjectEntityHandler = {}
		@res = new MockResponse()
		@req = new MockRequest()
		@next = sinon.stub()
		@project_id = "project-id-123"
		@doc_id = "doc-id-123"
		@doc_lines = ["one", "two", "three"]
		@version = 42
		@rev = 5

	describe "getDocument", ->
		beforeEach ->
			@req.params =
				Project_id: @project_id
				doc_id: @doc_id

		describe "when the document exists", ->
			beforeEach ->
				@ProjectEntityHandler.getDoc = sinon.stub().callsArgWith(2, null, @doc_lines, @rev)
				@DocumentController.getDocument(@req, @res, @next)

			it "should get the document from Mongo", ->
				@ProjectEntityHandler.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should return the document data to the client as JSON", ->
				@res.type.should.equal "json"
				@res.body.should.equal JSON.stringify
					lines: @doc_lines

		describe "when the document doesn't exist", ->
			beforeEach ->
				@ProjectEntityHandler.getDoc = sinon.stub().callsArgWith(2, new Errors.NotFoundError("not found"), null)
				@DocumentController.getDocument(@req, @res, @next)

			it "should call next with the NotFoundError", ->
				@next.calledWith(new Errors.NotFoundError("not found"))
					.should.equal true

	describe "setDocument", ->
		beforeEach ->
			@req.params =
				Project_id: @project_id
				doc_id: @doc_id

		describe "when the document exists", ->
			beforeEach ->
				@ProjectEntityHandler.updateDocLines = sinon.stub().callsArg(3)
				@req.body =
					lines: @doc_lines
				@DocumentController.setDocument(@req, @res, @next)

			it "should update the document in Mongo", ->
				@ProjectEntityHandler.updateDocLines
					.calledWith(@project_id, @doc_id, @doc_lines)
					.should.equal true

			it "should return a successful response", ->
				@res.success.should.equal true

		describe "when the document doesn't exist", ->
			beforeEach ->
				@ProjectEntityHandler.updateDocLines = sinon.stub().callsArgWith(3, new Errors.NotFoundError("document does not exist"))
				@req.body =
					lines: @doc_lines
				@DocumentController.setDocument(@req, @res, @next)

			it "should call next with the NotFoundError", ->
				@next.calledWith(new Errors.NotFoundError("not found"))
					.should.equal true

					
					

