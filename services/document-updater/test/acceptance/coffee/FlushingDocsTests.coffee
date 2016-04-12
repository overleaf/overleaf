sinon = require "sinon"
chai = require("chai")
chai.should()
expect = chai.expect
async = require "async"
{db, ObjectId} = require "../../../app/js/mongojs"

MockWebApi = require "./helpers/MockWebApi"
DocUpdaterClient = require "./helpers/DocUpdaterClient"

describe "Flushing a doc to Mongo", ->
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

			MockWebApi.insertDoc @project_id, @doc_id, lines: @lines
			db.docOps.insert {
				doc_id: ObjectId(@doc_id)
				version: @version
			}, (error) =>
				throw error if error?
				DocUpdaterClient.sendUpdates @project_id, @doc_id, [@update], (error) =>
					throw error if error?
					setTimeout () =>
						DocUpdaterClient.flushDoc @project_id, @doc_id, done
					, 200

		after ->
			MockWebApi.setDocumentLines.restore()

		it "should flush the updated doc lines to the web api", ->
			MockWebApi.setDocumentLines
				.calledWith(@project_id, @doc_id, @result)
				.should.equal true

		it "should store the updated doc version into mongo", (done) ->
			db.docOps.find {
				doc_id: ObjectId(@doc_id)
			}, {
				version: 1
			}, (error, docs) =>
				doc = docs[0]
				doc.version.should.equal @version + 1
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

	describe "when the web api http request takes a long time", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			@timeout = 10000
			MockWebApi.insertDoc @project_id, @doc_id, {
				lines: @lines
			}
			sinon.stub MockWebApi, "setDocumentLines", (project_id, doc_id, lines, callback = (error) ->) ->
				setTimeout callback, 30000

			db.docOps.insert {
				doc_id: ObjectId(@doc_id)
				version: @version
			}, (error) =>
				throw error if error?
				DocUpdaterClient.preloadDoc @project_id, @doc_id, done

		after ->
			MockWebApi.setDocumentLines.restore()
		
		it "should return quickly(ish)", (done) ->
			start = Date.now()
			DocUpdaterClient.flushDoc @project_id, @doc_id, (error, res, doc) =>
				res.statusCode.should.equal 500
				delta = Date.now() - start
				expect(delta).to.be.below 20000
				done()