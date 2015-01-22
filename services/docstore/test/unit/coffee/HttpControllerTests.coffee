SandboxedModule = require('sandboxed-module')
assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
chai.should()
expect = chai.expect
modulePath = require('path').join __dirname, '../../../app/js/HttpController'
ObjectId = require("mongojs").ObjectId

describe "HttpController", ->
	beforeEach ->
		@HttpController = SandboxedModule.require modulePath, requires:
			"./DocManager": @DocManager = {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
		@res = { send: sinon.stub(), json: sinon.stub(), setHeader:sinon.stub() }
		@req = {}
		@next = sinon.stub()
		@project_id = "mock-project-id"
		@doc_id = "mock-doc-id"
		@doc = {
			_id: @doc_id
			lines: ["mock", "lines", " here", "", "", " spaces "]
			version: 42
			rev: 5
		}

	describe "getDoc", ->
		beforeEach ->
			@req.params =
				project_id: @project_id
				doc_id: @doc_id
			@DocManager.getDoc = sinon.stub().callsArgWith(2, null, @doc)

		describe "without deleted docs", ->
			beforeEach ->
				@HttpController.getDoc @req, @res, @next

			it "should get the document (including deleted)", ->
				@DocManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

			it "should return the doc as JSON", ->
				@res.json
					.calledWith({
						_id: @doc_id
						lines: @doc.lines
						rev: @doc.rev
						deleted: false
					})
					.should.equal true

		describe "with deleted docs", ->
			beforeEach ->
				@HttpController.getDoc @req, @res, @next

			it "should get the document (without deleted)", ->
				@DocManager.getDoc
					.calledWith(@project_id, @doc_id)
					.should.equal true

	describe "getRawDoc", ->
		beforeEach ->
			@req.params =
				project_id: @project_id
				doc_id: @doc_id
			@DocManager.getDoc = sinon.stub().callsArgWith(2, null, @doc)
			@HttpController.getRawDoc @req, @res, @next

		it "should get the document", ->
			@DocManager.getDoc
				.calledWith(@project_id, @doc_id)
				.should.equal true

		it "should set the content type header", ->
			@res.setHeader.calledWith('content-type', 'text/plain').should.equal true

		it "should send the raw version of the doc", ->
			assert.deepEqual @res.send.args[0][0], "#{@doc.lines[0]}\n#{@doc.lines[1]}\n#{@doc.lines[2]}\n#{@doc.lines[3]}\n#{@doc.lines[4]}\n#{@doc.lines[5]}"

	describe "getAllDocs", ->
		describe "normally", ->
			beforeEach ->
				@req.params =
					project_id: @project_id
				@docs = [{
					_id: ObjectId()
					lines: ["mock", "lines", "one"]
					rev: 2
				}, {
					_id: ObjectId()
					lines: ["mock", "lines", "two"]
					rev: 4
				}]
				@DocManager.getAllDocs = sinon.stub().callsArgWith(1, null, @docs)
				@HttpController.getAllDocs @req, @res, @next

			it "should get all the docs", ->
				@DocManager.getAllDocs
					.calledWith(@project_id)
					.should.equal true

			it "should return the doc as JSON", ->
				@res.json
					.calledWith([{
						_id:   @docs[0]._id.toString()
						lines: @docs[0].lines
						rev:   @docs[0].rev
						deleted: false
					}, {
						_id:   @docs[1]._id.toString()
						lines: @docs[1].lines
						rev:   @docs[1].rev
						deleted: false
					}])
					.should.equal true

		describe "with a null doc", ->
			beforeEach ->
				@req.params =
					project_id: @project_id
				@docs = [{
					_id: ObjectId()
					lines: ["mock", "lines", "one"]
					rev: 2
				},
				null,
				{
					_id: ObjectId()
					lines: ["mock", "lines", "two"]
					rev: 4
				}]
				@DocManager.getAllDocs = sinon.stub().callsArgWith(1, null, @docs)
				@HttpController.getAllDocs @req, @res, @next

			it "should return the non null docs as JSON", ->
				@res.json
					.calledWith([{
						_id:   @docs[0]._id.toString()
						lines: @docs[0].lines
						rev:   @docs[0].rev
						deleted: false
					}, {
						_id:   @docs[2]._id.toString()
						lines: @docs[2].lines
						rev:   @docs[2].rev
						deleted: false
					}])
					.should.equal true

			it "should log out an error", ->
				@logger.error
					.calledWith(
						err: new Error("null doc")
						project_id: @project_id
						"encountered null doc"
					)
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
				@DocManager.updateDoc = sinon.stub().callsArgWith(3, null, true, @rev = 5)
				@HttpController.updateDoc @req, @res, @next

			it "should update the document", ->
				@DocManager.updateDoc
					.calledWith(@project_id, @doc_id, @lines)
					.should.equal true

			it "should return a modified status", ->
				@res.json
					.calledWith(modified: true, rev: @rev)
					.should.equal true

		describe "when the doc lines exist and were not updated", ->
			beforeEach ->
				@req.body =
					lines: @lines = ["hello", "world"]
				@DocManager.updateDoc = sinon.stub().callsArgWith(3, null, false, @rev = 5)
				@HttpController.updateDoc @req, @res, @next

			it "should return a modified status", ->
				@res.json
					.calledWith(modified: false, rev: @rev)
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

	describe "deleteDoc", ->
		beforeEach ->
			@req.params =
				project_id: @project_id
				doc_id: @doc_id
			@DocManager.deleteDoc = sinon.stub().callsArg(2)
			@HttpController.deleteDoc @req, @res, @next

		it "should delete the document", ->
			@DocManager.deleteDoc
				.calledWith(@project_id, @doc_id)
				.should.equal true

		it "should return a 204 (No Content)", ->
			@res.send
				.calledWith(204)
				.should.equal true
