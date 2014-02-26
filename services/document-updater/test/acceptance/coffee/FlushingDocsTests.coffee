sinon = require "sinon"
chai = require("chai")
chai.should()
async = require "async"

MockWebApi = require "./helpers/MockWebApi"
MockTrackChangesApi = require "./helpers/MockTrackChangesApi"
DocUpdaterClient = require "./helpers/DocUpdaterClient"
mongojs = require "../../../app/js/mongojs"
db = mongojs.db
ObjectId = mongojs.ObjectId

describe "Flushing a doc to Mongo", ->
	before ->
		@lines = ["one", "two", "three"]
		@update =
			doc: @doc_id
			op: [{
				i: "one and a half\n"
				p: 4
			}]
			v: 0
		@result = ["one", "one and a half", "two", "three"]
		MockWebApi.insertDoc @project_id, @doc_id, {
			lines: @lines
		}

	describe "when the updated doc exists in the doc updater", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			MockWebApi.insertDoc @project_id, @doc_id, {
				lines: @lines
			}
			sinon.spy MockWebApi, "setDocumentLines"
			sinon.spy MockTrackChangesApi, "flushDoc"

			DocUpdaterClient.sendUpdates @project_id, @doc_id, [@update], (error) =>
				throw error if error?
				setTimeout () =>
					DocUpdaterClient.flushDoc @project_id, @doc_id, done
				, 200

		after ->
			MockWebApi.setDocumentLines.restore()
			MockTrackChangesApi.flushDoc.restore()

		it "should flush the updated document to the web api", ->
			MockWebApi.setDocumentLines
				.calledWith(@project_id, @doc_id, @result)
				.should.equal true

		it "should flush the doc ops to Mongo", (done) ->
			db.docOps.find doc_id: ObjectId(@doc_id), (error, docs) =>
				doc = docs[0]
				doc.docOps[0].op.should.deep.equal @update.op
				done()

		it "should flush the doc in the track changes api", (done) ->
			# This is done in the background, so wait a little while to ensure it has happened
			setTimeout () =>
				MockTrackChangesApi.flushDoc.calledWith(@doc_id).should.equal true
				done()
			, 100

	describe "when the doc has a large number of ops to be flushed", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			MockWebApi.insertDoc @project_id, @doc_id, {
				lines: @lines
			}
			@updates = []
			for v in [0..999]
				@updates.push
					doc_id: @doc_id,
					op: [i: v.toString(), p: 0]
					v: v

			DocUpdaterClient.sendUpdates @project_id, @doc_id, @updates, (error) =>
				throw error if error?
				setTimeout () =>
					DocUpdaterClient.flushDoc @project_id, @doc_id, done
				, 200

		it "should flush the doc ops to Mongo in order", (done) ->
			db.docOps.find doc_id: ObjectId(@doc_id), (error, docs) =>
				doc = docs[0]
				updates = @updates.slice(-100)
				for update, i in doc.docOps
					update.op.should.deep.equal updates[i].op
				done()

	describe "when the doc does not exist in the doc updater", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			MockWebApi.insertDoc @project_id, @doc_id, {
				lines: @lines
			}
			sinon.spy MockWebApi, "setDocumentLines"
			DocUpdaterClient.flushDoc @project_id, @doc_id, done

		after ->
			MockWebApi.setDocumentLines.restore()

		it "should not flush the doc to the web api", ->
			MockWebApi.setDocumentLines.called.should.equal false


