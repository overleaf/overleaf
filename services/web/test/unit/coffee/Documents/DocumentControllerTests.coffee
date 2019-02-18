sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Documents/DocumentController.js"
SandboxedModule = require('sandboxed-module')
events = require "events"
MockRequest = require "../helpers/MockRequest"
MockResponse = require "../helpers/MockResponse"
Errors = require "../../../../app/js/Features/Errors/Errors"

describe "DocumentController", ->
	beforeEach ->
		@DocumentController = SandboxedModule.require modulePath, requires:
			"logger-sharelatex":
				log:->
				err:->
			"../Project/ProjectGetter": @ProjectGetter = {}
			"../Project/ProjectLocator": @ProjectLocator = {}
			"../Project/ProjectEntityHandler": @ProjectEntityHandler = {}
			"../Project/ProjectEntityUpdateHandler": @ProjectEntityUpdateHandler = {}
		@res = new MockResponse()
		@req = new MockRequest()
		@next = sinon.stub()
		@project_id = "project-id-123"
		@doc_id = "doc-id-123"
		@doc_lines = ["one", "two", "three"]
		@version = 42
		@ranges = {"mock": "ranges"}
		@pathname = '/a/b/c/file.tex'
		@rev = 5

	describe "getDocument", ->
		beforeEach ->
			@req.params =
				Project_id: @project_id
				doc_id: @doc_id

		describe "when the project exists without project history enabled", ->
			beforeEach ->
				@project = _id: @project_id
				@ProjectGetter.getProject = sinon.stub().callsArgWith(2, null, @project)

			describe "when the document exists", ->
				beforeEach ->
					@doc = _id: @doc_id
					@ProjectLocator.findElement = sinon.stub().callsArgWith(1, null, @doc, fileSystem: @pathname)
					@ProjectEntityHandler.getDoc = sinon.stub().callsArgWith(2, null, @doc_lines, @rev, @version, @ranges)
					@DocumentController.getDocument(@req, @res, @next)

				it "should get the project", ->
					@ProjectGetter.getProject
						.calledWith(@project_id, rootFolder: true, overleaf: true)
						.should.equal true

				it "should get the pathname of the document", ->
					@ProjectLocator.findElement
						.calledWith({project: @project, element_id: @doc_id, type: 'doc'})
						.should.equal true

				it "should get the document content", ->
					@ProjectEntityHandler.getDoc
						.calledWith(@project_id, @doc_id)
						.should.equal true

				it "should return the document data to the client as JSON", ->
					@res.type.should.equal "application/json"
					@res.body.should.equal JSON.stringify
						lines: @doc_lines
						version: @version
						ranges: @ranges
						pathname: @pathname

			describe "when the document doesn't exist", ->
				beforeEach ->
					@ProjectLocator.findElement = sinon.stub().callsArgWith(1, new Errors.NotFoundError("not found"))
					@DocumentController.getDocument(@req, @res, @next)

				it "should call next with the NotFoundError", ->
					@next.calledWith(new Errors.NotFoundError("not found"))
						.should.equal true

		describe "when project exists with project history enabled", ->
			beforeEach ->
				@doc = _id: @doc_id
				@projectHistoryId = 1234
				@project = _id: @project_id, overleaf: history: id: @projectHistoryId
				@ProjectGetter.getProject = sinon.stub().callsArgWith(2, null, @project)
				@ProjectLocator.findElement = sinon.stub().callsArgWith(1, null, @doc, fileSystem: @pathname)
				@ProjectEntityHandler.getDoc = sinon.stub().callsArgWith(2, null, @doc_lines, @rev, @version, @ranges)
				@DocumentController.getDocument(@req, @res, @next)

			it "should return the history id to the client as JSON", ->
				@res.type.should.equal "application/json"
				@res.body.should.equal JSON.stringify
					lines: @doc_lines
					version: @version
					ranges: @ranges
					pathname: @pathname
					projectHistoryId: @projectHistoryId

		describe "when the project does not exist", ->
			beforeEach ->
				@ProjectGetter.getProject = sinon.stub().callsArgWith(2, null, null)
				@DocumentController.getDocument(@req, @res, @next)

			it "returns a 404", ->
				@res.statusCode.should.equal 404

	describe "setDocument", ->
		beforeEach ->
			@req.params =
				Project_id: @project_id
				doc_id: @doc_id

		describe "when the document exists", ->
			beforeEach ->
				@ProjectEntityUpdateHandler.updateDocLines = sinon.stub().yields()
				@req.body =
					lines: @doc_lines
					version: @version
					ranges: @ranges
				@DocumentController.setDocument(@req, @res, @next)

			it "should update the document in Mongo", ->
				@ProjectEntityUpdateHandler.updateDocLines
					.calledWith(@project_id, @doc_id, @doc_lines, @version, @ranges)
					.should.equal true

			it "should return a successful response", ->
				@res.success.should.equal true

		describe "when the document doesn't exist", ->
			beforeEach ->
				@ProjectEntityUpdateHandler.updateDocLines = sinon.stub().yields(new Errors.NotFoundError("document does not exist"))
				@req.body =
					lines: @doc_lines
				@DocumentController.setDocument(@req, @res, @next)

			it "should call next with the NotFoundError", ->
				@next.calledWith(new Errors.NotFoundError("not found"))
					.should.equal true
