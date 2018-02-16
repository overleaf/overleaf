sinon = require "sinon"
chai = require("chai")
chai.should()
expect = chai.expect

MockWebApi = require "./helpers/MockWebApi"
DocUpdaterClient = require "./helpers/DocUpdaterClient"
DocUpdaterApp = require "./helpers/DocUpdaterApp"

describe "Getting a document", ->
	before (done) ->
		@lines = ["one", "two", "three"]
		@version = 42
		DocUpdaterApp.ensureRunning(done)

	describe "when the document is not loaded", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			sinon.spy MockWebApi, "getDocument"

			MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version}

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
			
			MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version}
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

			@updates = for v in [0..199]
				doc_id: @doc_id,
				op: [i: v.toString(), p: 0]
				v: v

			DocUpdaterClient.sendUpdates @project_id, @doc_id, @updates, (error) =>
				throw error if error?
				sinon.spy MockWebApi, "getDocument"
				done()

		after ->
			MockWebApi.getDocument.restore()
			
		describe "when the ops are loaded", ->
			before (done) ->
				DocUpdaterClient.getDocAndRecentOps @project_id, @doc_id, 190, (error, res, @returnedDoc) => done()

			it "should return the recent ops", ->
				@returnedDoc.ops.length.should.equal 10
				for update, i in @updates.slice(190, -1)
					@returnedDoc.ops[i].op.should.deep.equal update.op
					
		describe "when the ops are not all loaded", ->
			before (done) ->
				# We only track 100 ops
				DocUpdaterClient.getDocAndRecentOps @project_id, @doc_id, 10, (error, @res, @returnedDoc) => done()

			it "should return UnprocessableEntity", ->
				@res.statusCode.should.equal 422

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

	describe "when the web api http request takes a long time", ->
		before (done) ->
			@timeout = 10000
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			sinon.stub MockWebApi, "getDocument", (project_id, doc_id, callback = (error, doc) ->) ->
				setTimeout callback, 30000
			done()

		after ->
			MockWebApi.getDocument.restore()
		
		it "should return quickly(ish)", (done) ->
			start = Date.now()
			DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				res.statusCode.should.equal 500
				delta = Date.now() - start
				expect(delta).to.be.below 20000
				done()

