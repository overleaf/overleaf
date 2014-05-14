sinon = require "sinon"
chai = require("chai")
chai.should()
async = require "async"

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
		MockWebApi.insertDoc @project_id, @doc_id, {
			lines: @lines
			version: @version
		}

	describe "when the updated doc exists in the doc updater", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			MockWebApi.insertDoc @project_id, @doc_id, {
				lines: @lines
				version: @version
			}
			sinon.spy MockWebApi, "setDocumentLines"
			sinon.spy MockWebApi, "setDocumentVersion"

			DocUpdaterClient.sendUpdates @project_id, @doc_id, [@update], (error) =>
				throw error if error?
				setTimeout () =>
					DocUpdaterClient.flushDoc @project_id, @doc_id, done
				, 200

		after ->
			MockWebApi.setDocumentLines.restore()
			MockWebApi.setDocumentVersion.restore()

		it "should flush the updated doc lines to the web api", ->
			MockWebApi.setDocumentLines
				.calledWith(@project_id, @doc_id, @result)
				.should.equal true

		it "should flush the updated doc version to the web api", ->
			MockWebApi.setDocumentVersion
				.calledWith(@project_id, @doc_id, @version + 1)
				.should.equal true

	describe "when the doc does not exist in the doc updater", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			MockWebApi.insertDoc @project_id, @doc_id, {
				lines: @lines
				version: @version
			}
			sinon.spy MockWebApi, "setDocumentLines"
			sinon.spy MockWebApi, "setDocumentVersion"
			DocUpdaterClient.flushDoc @project_id, @doc_id, done

		after ->
			MockWebApi.setDocumentLines.restore()
			MockWebApi.setDocumentVersion.restore()

		it "should not flush the doc to the web api", ->
			MockWebApi.setDocumentLines.called.should.equal false
			MockWebApi.setDocumentVersion.called.should.equal false


