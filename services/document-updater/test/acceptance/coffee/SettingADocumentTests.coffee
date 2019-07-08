sinon = require "sinon"
chai = require("chai")
chai.should()
expect = require("chai").expect
Settings = require('settings-sharelatex')
rclient_du = require("redis-sharelatex").createClient(Settings.redis.documentupdater)
Keys = Settings.redis.documentupdater.key_schema

MockTrackChangesApi = require "./helpers/MockTrackChangesApi"
MockProjectHistoryApi = require "./helpers/MockProjectHistoryApi"
MockWebApi = require "./helpers/MockWebApi"
DocUpdaterClient = require "./helpers/DocUpdaterClient"
DocUpdaterApp = require "./helpers/DocUpdaterApp"

describe "Setting a document", ->
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
		@newLines = ["these", "are", "the", "new", "lines"]
		@source = "dropbox"
		@user_id = "user-id-123"

		sinon.spy MockTrackChangesApi, "flushDoc"
		sinon.spy MockProjectHistoryApi, "flushProject"
		sinon.spy MockWebApi, "setDocument"
		DocUpdaterApp.ensureRunning(done)

	after ->
		MockTrackChangesApi.flushDoc.restore()
		MockProjectHistoryApi.flushProject.restore()
		MockWebApi.setDocument.restore()

	describe "when the updated doc exists in the doc updater", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			MockWebApi.insertDoc @project_id, @doc_id, lines: @lines, version: @version
			DocUpdaterClient.preloadDoc @project_id, @doc_id, (error) =>
				throw error if error?
				DocUpdaterClient.sendUpdate @project_id, @doc_id, @update, (error) =>
					throw error if error?
					setTimeout () =>
						DocUpdaterClient.setDocLines @project_id, @doc_id, @newLines, @source, @user_id, false, (error, res, body) =>
							@statusCode = res.statusCode
							done()
					, 200
			return null

		it "should return a 204 status code", ->
			@statusCode.should.equal 204

		it "should send the updated doc lines and version to the web api", ->
			MockWebApi.setDocument
				.calledWith(@project_id, @doc_id, @newLines)
				.should.equal true

		it "should update the lines in the doc updater", (done) ->
			DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				doc.lines.should.deep.equal @newLines
				done()
			return null

		it "should bump the version in the doc updater", (done) ->
			DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				doc.version.should.equal @version + 2
				done()
			return null

		it "should leave the document in redis", (done) ->
			rclient_du.get Keys.docLines({doc_id: @doc_id}), (error, lines) =>
				throw error if error?
				expect(JSON.parse(lines)).to.deep.equal @newLines
				done()
			return null

	describe "when the updated doc does not exist in the doc updater", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version}
			DocUpdaterClient.setDocLines @project_id, @doc_id, @newLines, @source, @user_id, false, (error, res, body) =>
				@statusCode = res.statusCode
				setTimeout done, 200
			return null

		it "should return a 204 status code", ->
			@statusCode.should.equal 204

		it "should send the updated doc lines to the web api", ->
			MockWebApi.setDocument
				.calledWith(@project_id, @doc_id, @newLines)
				.should.equal true

		it "should flush track changes", ->
			MockTrackChangesApi.flushDoc.calledWith(@doc_id).should.equal true

		it "should flush project history", ->
			MockProjectHistoryApi.flushProject.calledWith(@project_id).should.equal true

		it "should remove the document from redis", (done) ->
			rclient_du.get Keys.docLines({doc_id: @doc_id}), (error, lines) =>
				throw error if error?
				expect(lines).to.not.exist
				done()
			return null

	describe "with track changes", ->
		before ->
			@lines = ["one", "one and a half", "two", "three"]
			@id_seed = "587357bd35e64f6157"
			@update =
				doc: @doc_id
				op: [{
					d: "one and a half\n"
					p: 4
				}]
				meta:
					tc: @id_seed
					user_id: @user_id
				v: @version

		describe "with the undo flag", ->
			before (done) ->
				[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
				MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version}
				DocUpdaterClient.preloadDoc @project_id, @doc_id, (error) =>
					throw error if error?
					DocUpdaterClient.sendUpdate @project_id, @doc_id, @update, (error) =>
						throw error if error?
						# Go back to old lines, with undo flag
						DocUpdaterClient.setDocLines @project_id, @doc_id, @lines, @source, @user_id, true, (error, res, body) =>
							@statusCode = res.statusCode
							setTimeout done, 200
				return null

			it "should undo the tracked changes", (done) ->
				DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, data) =>
					throw error if error?
					ranges = data.ranges
					expect(ranges.changes).to.be.undefined
					done()
				return null

		describe "without the undo flag", ->
			before (done) ->
				[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
				MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version}
				DocUpdaterClient.preloadDoc @project_id, @doc_id, (error) =>
					throw error if error?
					DocUpdaterClient.sendUpdate @project_id, @doc_id, @update, (error) =>
						throw error if error?
						# Go back to old lines, without undo flag
						DocUpdaterClient.setDocLines @project_id, @doc_id, @lines, @source, @user_id, false, (error, res, body) =>
							@statusCode = res.statusCode
							setTimeout done, 200
				return null

			it "should not undo the tracked changes", (done) ->
				DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, data) =>
					throw error if error?
					ranges = data.ranges
					expect(ranges.changes.length).to.equal 1
					done()
				return null


