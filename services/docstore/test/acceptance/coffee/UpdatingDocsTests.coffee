sinon = require "sinon"
chai = require("chai")
chai.should()
{ObjectId} = require "mongojs"

DocstoreClient = require "./helpers/DocstoreClient"

describe "Applying updates to a doc", ->
	beforeEach (done) ->
		@project_id = ObjectId()
		@doc_id = ObjectId()
		@originalLines = ["original", "lines"]
		@newLines = ["new", "lines"]
		@version = 42
		DocstoreClient.createDoc @project_id, @doc_id, @originalLines, (error) =>
			throw error if error?
			DocstoreClient.setDocVersion @doc_id, @version, (error) =>
				throw error if error?
				done()

	describe "when the content has changed", ->
		beforeEach (done) ->
			DocstoreClient.updateDoc @project_id, @doc_id, @newLines, null, (error, res, @body) =>
				done()

		it "should return modified = true", ->
			@body.modified.should.equal true

		it "should return the rev", ->
			@body.rev.should.equal 2

		it "should update the doc in the API but not change the version", (done) ->
			DocstoreClient.getDoc @project_id, @doc_id, {}, (error, res, doc) =>
				doc.lines.should.deep.equal @newLines
				doc.version.should.equal @version
				done()

	describe "when the content has not been updated", ->
		beforeEach (done) ->
			DocstoreClient.updateDoc @project_id, @doc_id, @originalLines, null, (error, res, @body) =>
				done()

		it "should return modified = false", ->
			@body.modified.should.equal false

		it "should not update the doc in the API", (done) ->
			DocstoreClient.getDoc @project_id, @doc_id, {}, (error, res, doc) =>
				doc.lines.should.deep.equal @originalLines
				done()

	describe "when the doc does not exist", ->
		beforeEach (done) ->
			@missing_doc_id = ObjectId()
			DocstoreClient.updateDoc @project_id, @missing_doc_id, @originalLines, null, (error, @res, @body) =>
				done()

		it "should create the doc", ->
			@body.rev.should.equal 1

		it "should be retreivable", (done)->
			DocstoreClient.getDoc @project_id, @missing_doc_id, {}, (error, res, doc) =>
				doc.lines.should.deep.equal @originalLines
				doc.version.should.equal 0
				done()

	describe "when malformed doc lines are provided", ->
		describe "when the lines are not an array", ->
			beforeEach (done) ->
				DocstoreClient.updateDoc @project_id, @doc_id, { foo: "bar" }, null, (error, @res, @body) =>
					done()

			it "should return 400", ->
				@res.statusCode.should.equal 400

			it "should not update the doc in the API", (done) ->
				DocstoreClient.getDoc @project_id, @doc_id, {}, (error, res, doc) =>
					doc.lines.should.deep.equal @originalLines
					done()

		describe "when the lines are not present", ->
			beforeEach (done) ->
				DocstoreClient.updateDoc @project_id, @doc_id, null, null, (error, @res, @body) =>
					done()

			it "should return 400", ->
				@res.statusCode.should.equal 400

			it "should not update the doc in the API", (done) ->
				DocstoreClient.getDoc @project_id, @doc_id, {}, (error, res, doc) =>
					doc.lines.should.deep.equal @originalLines
					done()

	describe "when the content is large", ->
		beforeEach (done) ->
			line = new Array(1025).join("x") # 1kb
			@largeLines = Array.apply(null, Array(1024)).map(() -> line) # 1mb
			DocstoreClient.updateDoc @project_id, @doc_id, @largeLines, null, (error, res, @body) =>
				done()

		it "should return modified = true", ->
			@body.modified.should.equal true

		it "should update the doc in the API", (done) ->
			DocstoreClient.getDoc @project_id, @doc_id, {}, (error, res, doc) =>
				doc.lines.should.deep.equal @largeLines
				done()

	describe "when the version has changed", ->
		beforeEach (done) ->
			DocstoreClient.updateDoc @project_id, @doc_id, @originalLines, @version + 1, (error, res, @body) =>
				done()

		it "should return modified = true", ->
			@body.modified.should.equal true

		it "should return the rev", ->
			@body.rev.should.equal 2

		it "should update the doc in the API", (done) ->
			DocstoreClient.getDoc @project_id, @doc_id, {}, (error, res, doc) =>
				doc.lines.should.deep.equal @originalLines
				doc.version.should.equal @version + 1
				done()

