sinon = require "sinon"
chai = require("chai")
chai.should()
expect = chai.expect
async = require "async"

MockWebApi = require "./helpers/MockWebApi"
DocUpdaterClient = require "./helpers/DocUpdaterClient"
DocUpdaterApp = require "./helpers/DocUpdaterApp"

describe "Flushing a doc to Mongo", ->
	before (done) ->
		@lines = ["one", "two", "three"]
		@version = 42
		@update =
			doc: @doc_id
			meta: { user_id: 'last-author-fake-id' }
			op: [{
				i: "one and a half\n"
				p: 4
			}]
			v: @version
		@result = ["one", "one and a half", "two", "three"]
		DocUpdaterApp.ensureRunning(done)

	describe "when the updated doc exists in the doc updater", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			sinon.spy MockWebApi, "setDocument"

			MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version}
			DocUpdaterClient.sendUpdates @project_id, @doc_id, [@update], (error) =>
				throw error if error?
				setTimeout () =>
					DocUpdaterClient.flushDoc @project_id, @doc_id, done
				, 200

		after ->
			MockWebApi.setDocument.restore()

		it "should flush the updated doc lines and version to the web api", ->
			MockWebApi.setDocument
				.calledWith(@project_id, @doc_id, @result, @version + 1)
				.should.equal true

		it "should flush the last update author and time to the web api", ->
			lastUpdatedAt = MockWebApi.setDocument.lastCall.args[5]
			parseInt(lastUpdatedAt).should.be.closeTo((new Date()).getTime(), 30000)

			lastUpdatedBy = MockWebApi.setDocument.lastCall.args[6]
			lastUpdatedBy.should.equal 'last-author-fake-id'

	describe "when the doc does not exist in the doc updater", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			MockWebApi.insertDoc @project_id, @doc_id, {
				lines: @lines
			}
			sinon.spy MockWebApi, "setDocument"
			DocUpdaterClient.flushDoc @project_id, @doc_id, done

		after ->
			MockWebApi.setDocument.restore()

		it "should not flush the doc to the web api", ->
			MockWebApi.setDocument.called.should.equal false

	describe "when the web api http request takes a long time on first request", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			MockWebApi.insertDoc @project_id, @doc_id, {
				lines: @lines
				version: @version
			}
			t = 30000
			sinon.stub MockWebApi, "setDocument", (project_id, doc_id, lines, version, ranges, lastUpdatedAt, lastUpdatedBy, callback = (error) ->) ->
				setTimeout callback, t
				t = 0
			DocUpdaterClient.preloadDoc @project_id, @doc_id, done

		after ->
			MockWebApi.setDocument.restore()
		
		it "should still work", (done) ->
			start = Date.now()
			DocUpdaterClient.flushDoc @project_id, @doc_id, (error, res, doc) =>
				res.statusCode.should.equal 204
				delta = Date.now() - start
				expect(delta).to.be.below 20000
				done()
