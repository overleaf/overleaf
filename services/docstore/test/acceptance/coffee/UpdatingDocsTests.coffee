sinon = require "sinon"
chai = require("chai")
chai.should()
{ObjectId} = require "mongojs"

DocstoreClient = require "./helpers/DocstoreClient"

describe "Applying updates to a doc", ->
	beforeEach (done) ->
		@project_id = ObjectId()
		@originalLines = ["original", "lines"]
		@newLines = ["new", "lines"]
		DocstoreClient.createDoc @project_id, @originalLines, (error, @doc_id) =>
			done()

	afterEach (done) ->
		DocstoreClient.deleteProject @project_id, done

	describe "when the content has changed", ->
		beforeEach (done) ->
			DocstoreClient.updateDoc @project_id, @doc_id, @newLines, (error, res, @body) =>
				done()

		it "should return modified = true", ->
			@body.modified.should.equal true

		it "should update the doc in the API", (done) ->
			DocstoreClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				doc.lines.should.deep.equal @newLines
				done()

	describe "when the content has not been updated", ->
		beforeEach (done) ->
			DocstoreClient.updateDoc @project_id, @doc_id, @originalLines, (error, res, @body) =>
				done()

		it "should return modified = false", ->
			@body.modified.should.equal false

		it "should not update the doc in the API", (done) ->
			DocstoreClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				doc.lines.should.deep.equal @originalLines
				done()

	describe "when the doc does not exist", ->
		beforeEach (done) ->
			missing_doc_id = ObjectId()
			DocstoreClient.updateDoc @project_id, missing_doc_id, @originalLines, (error, @res, @body) =>
				done()

		it "should return a 404", ->
			@res.statusCode.should.equal 404

	describe "when the project does not exist", ->
		beforeEach (done) ->
			missing_project_id = ObjectId()
			DocstoreClient.updateDoc missing_project_id, @doc_id, @originalLines, (error, @res, @body) =>
				done()

		it "should return a 404", ->
			@res.statusCode.should.equal 404

	describe "when malformed doc lines are provided", ->
		describe "when the lines are not an array", ->
			beforeEach (done) ->
				DocstoreClient.updateDoc @project_id, @doc_id, { foo: "bar" }, (error, @res, @body) =>
					done()

			it "should return 400", ->
				@res.statusCode.should.equal 400

			it "should not update the doc in the API", (done) ->
				DocstoreClient.getDoc @project_id, @doc_id, (error, res, doc) =>
					doc.lines.should.deep.equal @originalLines
					done()

		describe "when the lines are not present", ->
			beforeEach (done) ->
				DocstoreClient.updateDoc @project_id, @doc_id, null, (error, @res, @body) =>
					done()

			it "should return 400", ->
				@res.statusCode.should.equal 400

			it "should not update the doc in the API", (done) ->
				DocstoreClient.getDoc @project_id, @doc_id, (error, res, doc) =>
					doc.lines.should.deep.equal @originalLines
					done()

