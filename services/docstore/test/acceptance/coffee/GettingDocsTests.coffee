sinon = require "sinon"
chai = require("chai")
chai.should()
{ObjectId} = require "mongojs"
DocstoreApp = require "./helpers/DocstoreApp"

DocstoreClient = require "./helpers/DocstoreClient"

describe "Getting a doc", ->
	beforeEach (done) ->
		@project_id = ObjectId()
		@doc_id = ObjectId()
		@lines = ["original", "lines"]
		@version = 42
		@ranges = {
			changes: [{
				id: ObjectId().toString()
				op: { i: "foo", p: 3 }
				meta:
					user_id: ObjectId().toString()
					ts: new Date().toString()
			}]
		}
		DocstoreApp.ensureRunning =>
			DocstoreClient.createDoc @project_id, @doc_id, @lines, @version, @ranges, (error) =>
				throw error if error?
				done()

	describe "when the doc exists", ->
		it "should get the doc lines and version", (done) ->
			DocstoreClient.getDoc @project_id, @doc_id, {}, (error, res, doc) =>
				doc.lines.should.deep.equal @lines
				doc.version.should.equal @version
				doc.ranges.should.deep.equal @ranges
				done()

	describe "when the doc does not exist", ->
		it "should return a 404", (done) ->
			missing_doc_id = ObjectId()
			DocstoreClient.getDoc @project_id, missing_doc_id, {}, (error, res, doc) ->
				res.statusCode.should.equal 404
				done()

	describe "when the doc is a deleted doc", ->
		beforeEach (done) ->
			@deleted_doc_id = ObjectId()
			DocstoreClient.createDoc @project_id, @deleted_doc_id, @lines, @version, @ranges, (error) =>
				throw error if error?
				DocstoreClient.deleteDoc @project_id, @deleted_doc_id, done

		it "should return the doc", (done) ->
			DocstoreClient.getDoc @project_id, @deleted_doc_id, {include_deleted:true},(error, res, doc) =>
				doc.lines.should.deep.equal @lines
				doc.version.should.equal @version
				doc.ranges.should.deep.equal @ranges
				doc.deleted.should.equal true
				done()

		it "should return a 404 when the query string is not set", (done)->
			DocstoreClient.getDoc @project_id, @deleted_doc_id, {},(error, res, doc) =>
				res.statusCode.should.equal 404
				done()
	