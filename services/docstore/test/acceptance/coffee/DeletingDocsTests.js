sinon = require "sinon"
chai = require("chai")
chai.should()
{db, ObjectId} = require "../../../app/js/mongojs"
expect = chai.expect
DocstoreApp = require "./helpers/DocstoreApp"

DocstoreClient = require "./helpers/DocstoreClient"

describe "Deleting a doc", ->
	beforeEach (done) ->
		@project_id = ObjectId()
		@doc_id = ObjectId()
		@lines = ["original", "lines"]
		@version = 42
		@ranges = []
		DocstoreApp.ensureRunning =>
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

describe "Destroying a project's documents", ->
	describe "when the doc exists", ->
		beforeEach (done) ->
			db.docOps.insert {doc_id: ObjectId(@doc_id), version: 1}, (err) ->
				return done(err) if err?
				DocstoreClient.destroyAllDoc @project_id, done

		it "should remove the doc from the docs collection", (done) ->
			db.docs.find _id: @doc_id, (err, docs) ->
				expect(err).not.to.exist
				expect(docs).to.deep.equal []
				done()

		it "should remove the docOps from the docOps collection", (done) ->
			db.docOps.find doc_id: @doc_id, (err, docOps) ->
				expect(err).not.to.exist
				expect(docOps).to.deep.equal []
				done()

	describe "when the doc is archived", ->
		beforeEach (done) ->
			DocstoreClient.archiveAllDoc @project_id, (err) ->
				return done(err) if err?
				DocstoreClient.destroyAllDoc @project_id, done

		it "should remove the doc from the docs collection", (done) ->
			db.docs.find _id: @doc_id, (err, docs) ->
				expect(err).not.to.exist
				expect(docs).to.deep.equal []
				done()

		it "should remove the docOps from the docOps collection", (done) ->
			db.docOps.find doc_id: @doc_id, (err, docOps) ->
				expect(err).not.to.exist
				expect(docOps).to.deep.equal []
				done()

		it "should remove the doc contents from s3", (done) ->
			DocstoreClient.getS3Doc @project_id, @doc_id, (error, res, s3_doc) =>
				throw error if error?
				expect(res.statusCode).to.equal 404
				done()
