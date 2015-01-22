sinon = require "sinon"
chai = require("chai")
chai.should()
{ObjectId} = require "mongojs"

DocstoreClient = require "./helpers/DocstoreClient"

describe "Getting a doc", ->
	beforeEach (done) ->
		@project_id = ObjectId()
		@doc_id = ObjectId()
		@lines = ["original", "lines"]
		DocstoreClient.createProject @project_id, (error) =>
			throw error if error?
			DocstoreClient.createDoc @project_id, @doc_id, @lines, (error) =>
				throw error if error?
				done()

	afterEach (done) ->
		DocstoreClient.deleteProject @project_id, done

	describe "when the doc exists", ->
		it "should get the doc lines and version", (done) ->
			DocstoreClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				doc.lines.should.deep.equal @lines
				done()

	describe "when the doc does not exist", ->
		it "should return a 404", (done) ->
			missing_doc_id = ObjectId()
			DocstoreClient.getDoc @project_id, missing_doc_id, (error, res, doc) ->
				res.statusCode.should.equal 404
				done()

	describe "when the doc is a deleted doc", ->
		beforeEach (done) ->
			@deleted_doc_id = ObjectId()
			DocstoreClient.createDeletedDoc @project_id, @deleted_doc_id, @lines, done

		it "should return the doc", (done) ->
			DocstoreClient.getDoc @project_id, @deleted_doc_id, (error, res, doc) =>
				doc.lines.should.deep.equal @lines
				doc.deleted.should.equal true
				done()

	