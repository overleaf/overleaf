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
			"./DocArchiveManager": @DocArchiveManager = {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
			"./HealthChecker": {}
		@res = { send: sinon.stub(), json: sinon.stub(), setHeader:sinon.stub() }
		@req = { query:{}}
		@next = sinon.stub()
		@project_id = "mock-project-id"
		@doc_id = "mock-doc-id"
		@doc = {
			_id: @doc_id
			lines: ["mock", "lines", " here", "", "", " spaces "]
			version: 42
			rev: 5
		}
		@deletedDoc = {
			deleted:true
			_id: @doc_id
			lines: ["mock", "lines", " here", "", "", " spaces "]
			version: 42
			rev: 5
		}

	describe "getDoc", ->

		describe "without deleted docs", ->
			beforeEach ->
				@req.params =
					project_id: @project_id
					doc_id: @doc_id
				@DocManager.getDoc = sinon.stub().callsArgWith(3, null, @doc)
				@HttpController.getDoc @req, @res, @next

			it "should get the document with the version (including deleted)", ->
				@DocManager.getDoc
					.calledWith(@project_id, @doc_id, {version: true})
					.should.equal true

			it "should return the doc as JSON", ->
				@res.json
					.calledWith({
						_id: @doc_id
						lines: @doc.lines
						rev: @doc.rev
						deleted: false
						version: @doc.version
					})
					.should.equal true

		describe "which is deleted", ->
			beforeEach ->
				@req.params =
					project_id: @project_id
					doc_id: @doc_id
				@DocManager.getDoc = sinon.stub().callsArgWith(3, null, @deletedDoc)

			it "should get the doc from the doc manager", ->
				@HttpController.getDoc @req, @res, @next
				@DocManager.getDoc.calledWith(@project_id, @doc_id, {version: true}).should.equal true

			it "should return 404 if the query string delete is not set ", ->
				@HttpController.getDoc @req, @res, @next
				@res.send.calledWith(404).should.equal true

			it "should return the doc as JSON if include_deleted is set to true", ->
				@req.query.include_deleted = "true"
				@HttpController.getDoc @req, @res, @next
				@res.json
					.calledWith({
						_id: @doc_id
						lines: @doc.lines
						rev: @doc.rev
						deleted: true
						version: @doc.version
					})
					.should.equal true

	describe "getRawDoc", ->
		beforeEach ->
			@req.params =
				project_id: @project_id
				doc_id: @doc_id
			@DocManager.getDoc = sinon.stub().callsArgWith(3, null, @doc)
			@HttpController.getRawDoc @req, @res, @next

		it "should get the document without the version", ->
			@DocManager.getDoc
				.calledWith(@project_id, @doc_id, {version: false})
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
					version: @version = 42
				@DocManager.updateDoc = sinon.stub().yields(null, true, @rev = 5)
				@HttpController.updateDoc @req, @res, @next

			it "should update the document", ->
				@DocManager.updateDoc
					.calledWith(@project_id, @doc_id, @lines, @version)
					.should.equal true

			it "should return a modified status", ->
				@res.json
					.calledWith(modified: true, rev: @rev)
					.should.equal true

		describe "when the doc lines exist and were not updated", ->
			beforeEach ->
				@req.body =
					lines: @lines = ["hello", "world"]
					version: @version = 42
				@DocManager.updateDoc = sinon.stub().yields(null, false, @rev = 5)
				@HttpController.updateDoc @req, @res, @next

			it "should return a modified status", ->
				@res.json
					.calledWith(modified: false, rev: @rev)
					.should.equal true

		describe "when the doc lines are not provided", ->
			beforeEach ->
				@req.body = { version: 42 }
				@DocManager.updateDoc = sinon.stub().yields(null, false)
				@HttpController.updateDoc @req, @res, @next

			it "should not update the document", ->
				@DocManager.updateDoc.called.should.equal false

			it "should return a 400 (bad request) response", ->
				@res.send
					.calledWith(400)
					.should.equal true

		describe "when the doc version is not provided", ->
			beforeEach ->
				@req.body = { lines : [ "foo" ]}
				@DocManager.updateDoc = sinon.stub().yields(null, false)
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

	describe "archiveAllDocs", ->
		beforeEach ->
			@req.params =
				project_id: @project_id
			@DocArchiveManager.archiveAllDocs = sinon.stub().callsArg(1)
			@HttpController.archiveAllDocs @req, @res, @next

		it "should archive the project", ->
			@DocArchiveManager.archiveAllDocs
				.calledWith(@project_id)
				.should.equal true

		it "should return a 204 (No Content)", ->
			@res.send
				.calledWith(204)
				.should.equal true