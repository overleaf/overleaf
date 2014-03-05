sinon = require "sinon"
chai = require("chai")
chai.should()
expect = chai.expect
mongojs = require "../../../app/js/mongojs"
db = mongojs.db
ObjectId = mongojs.ObjectId
Settings = require "settings-sharelatex"

TrackChangesClient = require "./helpers/TrackChangesClient"
MockDocUpdaterApi = require "./helpers/MockDocUpdaterApi"

describe "Getting a diff", ->
	before (done) ->
		sinon.spy MockDocUpdaterApi, "getDoc"

		@now = Date.now()
		@from = @now - 100000000
		@to = @now
		@user_id = ObjectId().toString()
		@doc_id = ObjectId().toString()
		@project_id = ObjectId().toString()

		twoMinutes = 2 * 60 * 1000

		@updates = [{
			op: [{ i: "one ", p: 0 }]
			meta: { ts: @from - twoMinutes, user_id: @user_id }
			v: 3
		}, {
			op: [{ i: "two ", p: 4 }]
			meta: { ts: @from + twoMinutes, user_id: @user_id }
			v: 4
		}, {
			op: [{ i: "three ", p: 8 }]
			meta: { ts: @to - twoMinutes, user_id: @user_id }
			v: 5
		}, {
			op: [{ i: "four", p: 14 }]
			meta: { ts: @to + twoMinutes, user_id: @user_id }
			v: 6
		}]
		@lines = ["one two three four"]
		@expected_diff = [
			{ u: "one " }
			{ i: "two ", meta: { start_ts: @from + twoMinutes, end_ts: @from + twoMinutes, user_id: @user_id } }
			{ i: "three ", meta: { start_ts: @to - twoMinutes, end_ts: @to - twoMinutes, user_id: @user_id } }
		]

		MockDocUpdaterApi.docs[@doc_id] =
			lines: @lines
			version: 7

		TrackChangesClient.pushRawUpdates @doc_id, @updates, (error) =>
			throw error if error?
			TrackChangesClient.getDiff @project_id, @doc_id, @from, @to, (error, diff) =>
				throw error if error?
				@diff = diff.diff
				done()

	after () ->
		MockDocUpdaterApi.getDoc.restore()

	it "should return the diff", ->
		expect(@diff).to.deep.equal @expected_diff

	it "should get the doc from the doc updater", ->
		MockDocUpdaterApi.getDoc
			.calledWith(@project_id, @doc_id)
			.should.equal true
