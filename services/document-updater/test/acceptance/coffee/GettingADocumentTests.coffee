sinon = require "sinon"
chai = require("chai")
chai.should()
{db, ObjectId} = require "../../../app/js/mongojs"

MockWebApi = require "./helpers/MockWebApi"
DocUpdaterClient = require "./helpers/DocUpdaterClient"

describe "Getting a document", ->
	beforeEach ->
		@lines = ["one", "two", "three"]
		@version = 42

	describe "when the document is not loaded", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			sinon.spy MockWebApi, "getDocument"

			MockWebApi.insertDoc @project_id, @doc_id, lines: @lines
			db.docOps.insert {
				doc_id: ObjectId(@doc_id)
				version: @version
			}, (error) =>
				throw error if error?
				DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, @returnedDoc) => done()

		after ->
			MockWebApi.getDocument.restore()

		it "should load the document from the web API", ->
			MockWebApi.getDocument
				.calledWith(@project_id, @doc_id)
				.should.equal true
		
		it "should return the document lines", ->
			@returnedDoc.lines.should.deep.equal @lines

		it "should return the document at its current version", ->
			@returnedDoc.version.should.equal @version

	describe "when the document is already loaded", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			
			MockWebApi.insertDoc @project_id, @doc_id, lines: @lines
			db.docOps.insert {
				doc_id: ObjectId(@doc_id)
				version: @version
			}, (error) =>
				throw error if error?
				DocUpdaterClient.preloadDoc @project_id, @doc_id, (error) =>
					throw error if error?
					sinon.spy MockWebApi, "getDocument"
					DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, @returnedDoc) =>	done()

		after ->
			MockWebApi.getDocument.restore()

		it "should not load the document from the web API", ->
			MockWebApi.getDocument.called.should.equal false

		it "should return the document lines", ->
			@returnedDoc.lines.should.deep.equal @lines

	describe "when the request asks for some recent ops", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			MockWebApi.insertDoc @project_id, @doc_id, {
				lines: @lines = ["one", "two", "three"]
			}

			@updates = for v in [0..99]
				doc_id: @doc_id,
				op: [i: v.toString(), p: 0]
				v: v

			DocUpdaterClient.sendUpdates @project_id, @doc_id, @updates, (error) =>
				throw error if error?
				sinon.spy MockWebApi, "getDocument"
				DocUpdaterClient.getDocAndRecentOps @project_id, @doc_id, 90, (error, res, @returnedDoc) => done()

		after ->
			MockWebApi.getDocument.restore()

		it "should return the recent ops", ->
			@returnedDoc.ops.length.should.equal 10
			for update, i in @updates.slice(90, -1)
				@returnedDoc.ops[i].op.should.deep.equal update.op


	describe "when the document does not exist", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				@statusCode = res.statusCode
				done()

		it "should return 404", ->
			@statusCode.should.equal 404

	describe "when the web api returns an error", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			sinon.stub MockWebApi, "getDocument", (project_id, doc_id, callback = (error, doc) ->) ->
				callback new Error("oops")
			DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				@statusCode = res.statusCode
				done()

		after ->
			MockWebApi.getDocument.restore()

		it "should return 500", ->
			@statusCode.should.equal 500





