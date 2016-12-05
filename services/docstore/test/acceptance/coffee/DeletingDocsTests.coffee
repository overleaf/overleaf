sinon = require "sinon"
chai = require("chai")
chai.should()
{db, ObjectId} = require "../../../app/js/mongojs"

DocstoreClient = require "./helpers/DocstoreClient"

describe "Deleting a doc", ->
	beforeEach (done) ->
		@project_id = ObjectId()
		@doc_id = ObjectId()
		@lines = ["original", "lines"]
		@version = 42
		@ranges = []
		DocstoreClient.createDoc @project_id, @doc_id, @lines, @version, @ranges, (error) =>
			throw error if error?
			done()

	describe "when the doc exists", ->
		beforeEach (done) ->
			DocstoreClient.deleteDoc @project_id, @doc_id, (error, @res, doc) =>
				done()

		afterEach (done) ->
			db.docs.remove({_id: @doc_id}, done)

		it "should insert a deleted doc into the docs collection", (done) ->
			db.docs.find _id: @doc_id, (error, docs) =>
				docs[0]._id.should.deep.equal @doc_id
				docs[0].lines.should.deep.equal @lines
				docs[0].deleted.should.equal true
				done()

	describe "when the doc does not exist", ->
		it "should return a 404", (done) ->
			missing_doc_id = ObjectId()
			DocstoreClient.deleteDoc @project_id, missing_doc_id, (error, res, doc) ->
				res.statusCode.should.equal 404
				done()

