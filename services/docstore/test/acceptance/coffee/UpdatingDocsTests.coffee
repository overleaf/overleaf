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
		@originalRanges = {
			changes: [{
				id: ObjectId().toString()
				op: { i: "foo", p: 3 }
				meta:
					user_id: ObjectId().toString()
					ts: new Date().toString()
			}]
		}
		@newRanges = {
			changes: [{
				id: ObjectId().toString()
				op: { i: "bar", p: 6 }
				meta:
					user_id: ObjectId().toString()
					ts: new Date().toString()
			}]
		}
		@version = 42
		DocstoreClient.createDoc @project_id, @doc_id, @originalLines, @version, @originalRanges, (error) =>
			throw error if error?
			done()

	describe "when nothing has been updated", ->
		beforeEach (done) ->
			DocstoreClient.updateDoc @project_id, @doc_id, @originalLines, @version, @originalRanges, (error, res, @body) =>
				done()

		it "should return modified = false", ->
			@body.modified.should.equal false

		it "should not update the doc in the API", (done) ->
			DocstoreClient.getDoc @project_id, @doc_id, {}, (error, res, doc) =>
				doc.lines.should.deep.equal @originalLines
				doc.version.should.equal @version
				doc.ranges.should.deep.equal @originalRanges
				done()

	describe "when the lines have changed", ->
		beforeEach (done) ->
			DocstoreClient.updateDoc @project_id, @doc_id, @newLines, @version, @originalRanges, (error, res, @body) =>
				done()

		it "should return modified = true", ->
			@body.modified.should.equal true

		it "should return the rev", ->
			@body.rev.should.equal 2

		it "should update the doc in the API", (done) ->
			DocstoreClient.getDoc @project_id, @doc_id, {}, (error, res, doc) =>
				doc.lines.should.deep.equal @newLines
				doc.version.should.equal @version
				doc.ranges.should.deep.equal @originalRanges
				done()

	describe "when the version has changed", ->
		beforeEach (done) ->
			DocstoreClient.updateDoc @project_id, @doc_id, @originalLines, @version + 1, @originalRanges, (error, res, @body) =>
				done()

		it "should return modified = true", ->
			@body.modified.should.equal true

		it "should return the rev", ->
			@body.rev.should.equal 2

		it "should update the doc in the API", (done) ->
			DocstoreClient.getDoc @project_id, @doc_id, {}, (error, res, doc) =>
				doc.lines.should.deep.equal @originalLines
				doc.version.should.equal @version + 1
				doc.ranges.should.deep.equal @originalRanges
				done()

	describe "when the ranges have changed", ->
		beforeEach (done) ->
			DocstoreClient.updateDoc @project_id, @doc_id, @originalLines, @version, @newRanges, (error, res, @body) =>
				done()

		it "should return modified = true", ->
			@body.modified.should.equal true

		it "should return the rev", ->
			@body.rev.should.equal 2

		it "should update the doc in the API", (done) ->
			DocstoreClient.getDoc @project_id, @doc_id, {}, (error, res, doc) =>
				doc.lines.should.deep.equal @originalLines
				doc.version.should.equal @version
				doc.ranges.should.deep.equal @newRanges
				done()

	describe "when the doc does not exist", ->
		beforeEach (done) ->
			@missing_doc_id = ObjectId()
			DocstoreClient.updateDoc @project_id, @missing_doc_id, @originalLines, 0, @originalRanges, (error, @res, @body) =>
				done()

		it "should create the doc", ->
			@body.rev.should.equal 1

		it "should be retreivable", (done)->
			DocstoreClient.getDoc @project_id, @missing_doc_id, {}, (error, res, doc) =>
				doc.lines.should.deep.equal @originalLines
				doc.version.should.equal 0
				doc.ranges.should.deep.equal @originalRanges
				done()

	describe "when malformed doc lines are provided", ->
		describe "when the lines are not an array", ->
			beforeEach (done) ->
				DocstoreClient.updateDoc @project_id, @doc_id, { foo: "bar" }, @version, @originalRanges, (error, @res, @body) =>
					done()

			it "should return 400", ->
				@res.statusCode.should.equal 400

			it "should not update the doc in the API", (done) ->
				DocstoreClient.getDoc @project_id, @doc_id, {}, (error, res, doc) =>
					doc.lines.should.deep.equal @originalLines
					done()

		describe "when the lines are not present", ->
			beforeEach (done) ->
				DocstoreClient.updateDoc @project_id, @doc_id, null, @version, @originalRanges, (error, @res, @body) =>
					done()

			it "should return 400", ->
				@res.statusCode.should.equal 400

			it "should not update the doc in the API", (done) ->
				DocstoreClient.getDoc @project_id, @doc_id, {}, (error, res, doc) =>
					doc.lines.should.deep.equal @originalLines
					done()
	
	describe "when no version is provided", ->
		beforeEach (done) ->
			DocstoreClient.updateDoc @project_id, @doc_id, @originalLines, null, @originalRanges, (error, @res, @body) =>
				done()

		it "should return 400", ->
			@res.statusCode.should.equal 400

		it "should not update the doc in the API", (done) ->
			DocstoreClient.getDoc @project_id, @doc_id, {}, (error, res, doc) =>
				doc.lines.should.deep.equal @originalLines
				doc.version.should.equal @version
				done()

	describe "when the content is large", ->
		beforeEach (done) ->
			line = new Array(1025).join("x") # 1kb
			@largeLines = Array.apply(null, Array(1024)).map(() -> line) # 1mb
			DocstoreClient.updateDoc @project_id, @doc_id, @largeLines, @version, @originalRanges, (error, res, @body) =>
				done()

		it "should return modified = true", ->
			@body.modified.should.equal true

		it "should update the doc in the API", (done) ->
			DocstoreClient.getDoc @project_id, @doc_id, {}, (error, res, doc) =>
				doc.lines.should.deep.equal @largeLines
				done()
