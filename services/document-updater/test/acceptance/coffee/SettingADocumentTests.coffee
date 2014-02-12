sinon = require "sinon"
chai = require("chai")
chai.should()

MockWebApi = require "./helpers/MockWebApi"
DocUpdaterClient = require "./helpers/DocUpdaterClient"

describe "Setting a document", ->
	before ->
		[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
		@lines = ["one", "two", "three"]
		@update =
			doc: @doc_id
			op: [{
				i: "one and a half\n"
				p: 4
			}]
			v: 0
		@result = ["one", "one and a half", "two", "three"]
		@newLines = ["these", "are", "the", "new", "lines"]
		MockWebApi.insertDoc @project_id, @doc_id, {
			lines: @lines
		}

	describe "when the updated doc exists in the doc updater", ->
		before (done) ->
			sinon.spy MockWebApi, "setDocumentLines"
			DocUpdaterClient.preloadDoc @project_id, @doc_id, (error) =>
				throw error if error?
				DocUpdaterClient.sendUpdate @project_id, @doc_id, @update, (error) =>
					throw error if error?
					setTimeout () =>
						DocUpdaterClient.setDocLines @project_id, @doc_id, @newLines, (error, res, body) =>
							@statusCode = res.statusCode
							done()
					, 200

		after ->
			MockWebApi.setDocumentLines.restore()

		it "should return a 204 status code", ->
			@statusCode.should.equal 204

		it "should send the updated document to the web api", ->
			MockWebApi.setDocumentLines
				.calledWith(@project_id, @doc_id, @newLines)
				.should.equal true

		it "should update the lines in the doc updater", (done) ->
			DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				doc.lines.should.deep.equal @newLines
				done()

		it "should bump the version in the doc updater", (done) ->
			DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				doc.version.should.equal 2
				done()

