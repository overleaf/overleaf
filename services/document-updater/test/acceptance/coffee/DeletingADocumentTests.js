sinon = require "sinon"
chai = require("chai")
chai.should()

MockTrackChangesApi = require "./helpers/MockTrackChangesApi"
MockProjectHistoryApi = require "./helpers/MockProjectHistoryApi"
MockWebApi = require "./helpers/MockWebApi"
DocUpdaterClient = require "./helpers/DocUpdaterClient"
DocUpdaterApp = require "./helpers/DocUpdaterApp"

describe "Deleting a document", ->
	before (done) ->
		@lines = ["one", "two", "three"]
		@version = 42
		@update =
			doc: @doc_id
			op: [{
				i: "one and a half\n"
				p: 4
			}]
			v: @version
		@result = ["one", "one and a half", "two", "three"]

		sinon.spy MockTrackChangesApi, "flushDoc"
		sinon.spy MockProjectHistoryApi, "flushProject"
		DocUpdaterApp.ensureRunning(done)

	after ->
		MockTrackChangesApi.flushDoc.restore()
		MockProjectHistoryApi.flushProject.restore()

	describe "when the updated doc exists in the doc updater", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			sinon.spy MockWebApi, "setDocument"
			sinon.spy MockWebApi, "getDocument"

			MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version}
			DocUpdaterClient.preloadDoc @project_id, @doc_id, (error) =>
				throw error if error?
				DocUpdaterClient.sendUpdate @project_id, @doc_id, @update, (error) =>
					throw error if error?
					setTimeout () =>
						DocUpdaterClient.deleteDoc @project_id, @doc_id, (error, res, body) =>
							@statusCode = res.statusCode
							setTimeout done, 200
					, 200

		after ->
			MockWebApi.setDocument.restore()
			MockWebApi.getDocument.restore()

		it "should return a 204 status code", ->
			@statusCode.should.equal 204

		it "should send the updated document and version to the web api", ->
			MockWebApi.setDocument
				.calledWith(@project_id, @doc_id, @result, @version + 1)
				.should.equal true

		it "should need to reload the doc if read again", (done) ->
			MockWebApi.getDocument.called.should.equal.false
			DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				MockWebApi.getDocument
					.calledWith(@project_id, @doc_id)
					.should.equal true
				done()

		it "should flush track changes", ->
			MockTrackChangesApi.flushDoc.calledWith(@doc_id).should.equal true

		it "should flush project history", ->
			MockProjectHistoryApi.flushProject.calledWith(@project_id).should.equal true

	describe "when the doc is not in the doc updater", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			MockWebApi.insertDoc @project_id, @doc_id, {
				lines: @lines
			}
			sinon.spy MockWebApi, "setDocument"
			sinon.spy MockWebApi, "getDocument"
			DocUpdaterClient.deleteDoc @project_id, @doc_id, (error, res, body) =>
				@statusCode = res.statusCode
				setTimeout done, 200

		after ->
			MockWebApi.setDocument.restore()
			MockWebApi.getDocument.restore()

		it "should return a 204 status code", ->
			@statusCode.should.equal 204

		it "should not need to send the updated document to the web api", ->
			MockWebApi.setDocument.called.should.equal false

		it "should need to reload the doc if read again", (done) ->
			MockWebApi.getDocument.called.should.equal.false
			DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				MockWebApi.getDocument
					.calledWith(@project_id, @doc_id)
					.should.equal true
				done()

		it "should flush track changes", ->
			MockTrackChangesApi.flushDoc.calledWith(@doc_id).should.equal true

		it "should flush project history", ->
			MockProjectHistoryApi.flushProject.calledWith(@project_id).should.equal true
