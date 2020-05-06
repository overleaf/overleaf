sinon = require "sinon"
chai = require("chai")
chai.should()
async = require "async"

MockTrackChangesApi = require "./helpers/MockTrackChangesApi"
MockProjectHistoryApi = require "./helpers/MockProjectHistoryApi"
MockWebApi = require "./helpers/MockWebApi"
DocUpdaterClient = require "./helpers/DocUpdaterClient"
DocUpdaterApp = require "./helpers/DocUpdaterApp"

describe "Deleting a project", ->
	before (done) ->
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

		DocUpdaterApp.ensureRunning(done)


	describe "with documents which have been updated", ->
		before (done) ->
			sinon.spy MockWebApi, "setDocument"
			sinon.spy MockTrackChangesApi, "flushDoc"
			sinon.spy MockProjectHistoryApi, "flushProject"

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
			MockWebApi.setDocument.restore()
			MockTrackChangesApi.flushDoc.restore()
			MockProjectHistoryApi.flushProject.restore()

		it "should return a 204 status code", ->
			@statusCode.should.equal 204

		it "should send each document to the web api", ->
			for doc in @docs
				MockWebApi.setDocument
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

		it "should flush each doc in track changes", ->
			for doc in @docs
				MockTrackChangesApi.flushDoc.calledWith(doc.id).should.equal true

		it "should flush each doc in project history", ->
			MockProjectHistoryApi.flushProject.calledWith(@project_id).should.equal true

	describe "with the background=true parameter from realtime and no request to flush the queue", ->
		before (done) ->
			sinon.spy MockWebApi, "setDocument"
			sinon.spy MockTrackChangesApi, "flushDoc"
			sinon.spy MockProjectHistoryApi, "flushProject"

			async.series @docs.map((doc) =>
				(callback) =>
					DocUpdaterClient.preloadDoc @project_id, doc.id, callback
			), (error) =>
				throw error if error?
				setTimeout () =>
					DocUpdaterClient.deleteProjectOnShutdown @project_id, (error, res, body) =>
						@statusCode = res.statusCode
						done()
				, 200

		after ->
			MockWebApi.setDocument.restore()
			MockTrackChangesApi.flushDoc.restore()
			MockProjectHistoryApi.flushProject.restore()

		it "should return a 204 status code", ->
			@statusCode.should.equal 204

		it "should not send any documents to the web api", ->
			MockWebApi.setDocument.called.should.equal false

		it "should not flush any docs in track changes", ->
			MockTrackChangesApi.flushDoc.called.should.equal false

		it "should not flush to project history", ->
			MockProjectHistoryApi.flushProject.called.should.equal false

	describe "with the background=true parameter from realtime and a request to flush the queue", ->
		before (done) ->
			sinon.spy MockWebApi, "setDocument"
			sinon.spy MockTrackChangesApi, "flushDoc"
			sinon.spy MockProjectHistoryApi, "flushProject"

			async.series @docs.map((doc) =>
				(callback) =>
					DocUpdaterClient.preloadDoc @project_id, doc.id, callback
			), (error) =>
				throw error if error?
				setTimeout () =>
					DocUpdaterClient.deleteProjectOnShutdown @project_id, (error, res, body) =>
						@statusCode = res.statusCode
						# after deleting the project and putting it in the queue, flush the queue
						setTimeout () ->
							DocUpdaterClient.flushOldProjects done
						, 2000
				, 200

		after ->
			MockWebApi.setDocument.restore()
			MockTrackChangesApi.flushDoc.restore()
			MockProjectHistoryApi.flushProject.restore()

		it "should return a 204 status code", ->
			@statusCode.should.equal 204

		it "should send each document to the web api", ->
			for doc in @docs
				MockWebApi.setDocument
					.calledWith(@project_id, doc.id, doc.updatedLines)
					.should.equal true

		it "should flush each doc in track changes", ->
			for doc in @docs
				MockTrackChangesApi.flushDoc.calledWith(doc.id).should.equal true

		it "should flush to project history", ->
			MockProjectHistoryApi.flushProject.called.should.equal true

