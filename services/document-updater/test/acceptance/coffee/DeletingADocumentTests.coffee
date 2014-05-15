sinon = require "sinon"
chai = require("chai")
chai.should()
{db, ObjectId} = require "../../../app/js/mongojs"

MockWebApi = require "./helpers/MockWebApi"
DocUpdaterClient = require "./helpers/DocUpdaterClient"

describe "Deleting a document", ->
	before ->
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

	describe "when the updated doc exists in the doc updater", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			sinon.spy MockWebApi, "setDocumentLines"
			sinon.spy MockWebApi, "getDocument"

			MockWebApi.insertDoc @project_id, @doc_id, lines: @lines
			db.docOps.insert {
				doc_id: ObjectId(@doc_id)
				version: @version
			}, (error) =>
				throw error if error?
				DocUpdaterClient.preloadDoc @project_id, @doc_id, (error) =>
					throw error if error?
					DocUpdaterClient.sendUpdate @project_id, @doc_id, @update, (error) =>
						throw error if error?
						setTimeout () =>
							DocUpdaterClient.deleteDoc @project_id, @doc_id, (error, res, body) =>
								@statusCode = res.statusCode
								done()
						, 200

		after ->
			MockWebApi.setDocumentLines.restore()
			MockWebApi.getDocument.restore()

		it "should return a 204 status code", ->
			@statusCode.should.equal 204

		it "should send the updated document to the web api", ->
			MockWebApi.setDocumentLines
				.calledWith(@project_id, @doc_id, @result)
				.should.equal true

		it "should write the version to mongo", (done) ->
			db.docOps.find {
				doc_id: ObjectId(@doc_id)
			}, {
				version: 1
			}, (error, docs) =>
				doc = docs[0]
				doc.version.should.equal @version + 1
				done()

		it "should need to reload the doc if read again", (done) ->
			MockWebApi.getDocument.called.should.equal.false
			DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				MockWebApi.getDocument
					.calledWith(@project_id, @doc_id)
					.should.equal true
				done()

	describe "when the doc is not in the doc updater", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			MockWebApi.insertDoc @project_id, @doc_id, {
				lines: @lines
			}
			sinon.spy MockWebApi, "setDocumentLines"
			sinon.spy MockWebApi, "getDocument"
			DocUpdaterClient.deleteDoc @project_id, @doc_id, (error, res, body) =>
				@statusCode = res.statusCode
				done()

		after ->
			MockWebApi.setDocumentLines.restore()
			MockWebApi.getDocument.restore()

		it "should return a 204 status code", ->
			@statusCode.should.equal 204

		it "should not need to send the updated document to the web api", ->
			MockWebApi.setDocumentLines.called.should.equal false

		it "should need to reload the doc if read again", (done) ->
			MockWebApi.getDocument.called.should.equal.false
			DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				MockWebApi.getDocument
					.calledWith(@project_id, @doc_id)
					.should.equal true
				done()

		

