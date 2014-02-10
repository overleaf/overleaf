sinon = require "sinon"
chai = require("chai")
chai.should()
async = require "async"

MockWebApi = require "./helpers/MockWebApi"
DocUpdaterClient = require "./helpers/DocUpdaterClient"

describe "Deleting a project", ->
	before ->
		@project_id = DocUpdaterClient.randomId()
		@docs = [{
			id: doc_id0 = DocUpdaterClient.randomId()
			lines: ["one", "two", "three"]
			update:
				doc: doc_id0
				op: [{
					i: "one and a half\n"
					p: 4
				}]
				v: 0
			updatedLines: ["one", "one and a half", "two", "three"]
		}, {
			id: doc_id1 = DocUpdaterClient.randomId()
			lines: ["four", "five", "six"]
			update:
				doc: doc_id1
				op: [{
					i: "four and a half\n"
					p: 5
				}]
				v: 0
			updatedLines: ["four", "four and a half", "five", "six"]
		}]
		for doc in @docs
			MockWebApi.insertDoc @project_id, doc.id, {
				lines: doc.lines
				version: doc.update.v
			}

	describe "with documents which have been updated", ->
		before (done) ->
			sinon.spy MockWebApi, "setDocumentLines"
			async.series @docs.map((doc) =>
				(callback) =>
					DocUpdaterClient.preloadDoc @project_id, doc.id, (error) =>
						return callback(error) if error?
						DocUpdaterClient.sendUpdate @project_id, doc.id, doc.update, (error) =>
							callback(error)
			), (error) =>
				throw error if error?
				setTimeout () =>
					DocUpdaterClient.deleteProject @project_id, (error, res, body) =>
						@statusCode = res.statusCode
						done()
				, 200

		after ->
			MockWebApi.setDocumentLines.restore()

		it "should return a 204 status code", ->
			@statusCode.should.equal 204

		it "should send each document to the web api", ->
			for doc in @docs
				MockWebApi.setDocumentLines
					.calledWith(@project_id, doc.id, doc.updatedLines)
					.should.equal true

		it "should need to reload the docs if read again", (done) ->
			sinon.spy MockWebApi, "getDocument"
			async.series @docs.map((doc) =>
				(callback) =>
					MockWebApi.getDocument.calledWith(@project_id, doc.id).should.equal false
					DocUpdaterClient.getDoc @project_id, doc.id, (error, res, returnedDoc) =>
						MockWebApi.getDocument.calledWith(@project_id, doc.id).should.equal true
						callback()
			), () ->
				MockWebApi.getDocument.restore()
				done()


