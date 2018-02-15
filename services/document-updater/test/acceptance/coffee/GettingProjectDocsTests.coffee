sinon = require "sinon"
chai = require("chai")
chai.should()
expect = chai.expect

MockWebApi = require "./helpers/MockWebApi"
DocUpdaterClient = require "./helpers/DocUpdaterClient"
DocUpdaterApp = require "./helpers/DocUpdaterApp"

describe "Getting documents for project", ->
	before (done) ->
		@lines = ["one", "two", "three"]
		@version = 42
		DocUpdaterApp.ensureRunning(done)

	describe "when project state hash does not match", ->
		before (done) ->
			@projectStateHash = DocUpdaterClient.randomId()
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]

			MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version}
			DocUpdaterClient.preloadDoc @project_id, @doc_id, (error) =>
				throw error if error?
				DocUpdaterClient.getProjectDocs @project_id, @projectStateHash, (error, @res, @returnedDocs)	=>
					done()

		it "should return a 409 Conflict response", ->
			@res.statusCode.should.equal 409


	describe "when project state hash matches", ->
		before (done) ->
			@projectStateHash = DocUpdaterClient.randomId()
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]

			MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version}
			DocUpdaterClient.preloadDoc @project_id, @doc_id, (error) =>
				throw error if error?
				DocUpdaterClient.getProjectDocs @project_id, @projectStateHash, (error, @res0, @returnedDocs0)	=>
					# set the hash
					DocUpdaterClient.getProjectDocs @project_id, @projectStateHash, (error, @res, @returnedDocs)	=>
						# the hash should now match
						done()

		it "should return a 200 response", ->
			@res.statusCode.should.equal 200

		it "should return the documents", ->
			@returnedDocs.should.deep.equal [ {_id: @doc_id, lines: @lines, v: @version} ]


	describe "when the doc has been removed", ->
		before (done) ->
			@projectStateHash = DocUpdaterClient.randomId()
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]

			MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version}
			DocUpdaterClient.preloadDoc @project_id, @doc_id, (error) =>
				throw error if error?
				DocUpdaterClient.getProjectDocs @project_id, @projectStateHash, (error, @res0, @returnedDocs0)	=>
					# set the hash
					DocUpdaterClient.deleteDoc @project_id, @doc_id, (error, res, body) =>
					# delete the doc
						DocUpdaterClient.getProjectDocs @project_id, @projectStateHash, (error, @res, @returnedDocs)	=>
							# the hash would match, but the doc has been deleted
							done()

		it "should return a 409 Conflict response", ->
			@res.statusCode.should.equal 409
