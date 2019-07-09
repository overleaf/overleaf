sinon = require "sinon"
chai = require("chai")
chai.should()
expect = chai.expect
mongojs = require "../../../app/js/mongojs"
db = mongojs.db
ObjectId = mongojs.ObjectId
Settings = require "settings-sharelatex"

TrackChangesApp = require "./helpers/TrackChangesApp"
TrackChangesClient = require "./helpers/TrackChangesClient"
MockDocUpdaterApi = require "./helpers/MockDocUpdaterApi"
MockWebApi = require "./helpers/MockWebApi"

describe "Getting a diff", ->

	beforeEach (done) ->
		sinon.spy MockDocUpdaterApi, "getDoc"

		@now = Date.now()
		@from = @now - 100000000
		@to = @now
		@user_id = ObjectId().toString()
		@doc_id = ObjectId().toString()
		@project_id = ObjectId().toString()
		MockWebApi.projects[@project_id] = features: versioning: true

		MockWebApi.users[@user_id] = @user =
			email: "user@sharelatex.com"
			first_name: "Leo"
			last_name: "Lion"
			id: @user_id
		sinon.spy MockWebApi, "getUserInfo"

		twoMinutes = 2 * 60 * 1000

		@updates = [{
			op: [{ i: "one ", p: 0 }]
			meta: { ts: @from - twoMinutes, user_id: @user_id }
			v: 3
		}, {
			op: [{ i: "two ", p: 4 }]
			meta: { ts: @from + twoMinutes, user_id: @user_id }
			v: @fromVersion = 4
		}, {
			op: [{ i: "three ", p: 8 }]
			meta: { ts: @to - twoMinutes, user_id: @user_id }
			v: @toVersion = 5
		}, {
			op: [{ i: "four", p: 14 }]
			meta: { ts: @to + twoMinutes, user_id: @user_id }
			v: 6
		}]
		@lines = ["one two three four"]
		@expected_diff = [
			{ u: "one " }
			{ i: "two three ", meta: { start_ts: @from + twoMinutes, end_ts: @to - twoMinutes, user: @user } }
		]

		MockDocUpdaterApi.docs[@doc_id] =
			lines: @lines
			version: 7
		TrackChangesApp.ensureRunning =>
			TrackChangesClient.pushRawUpdates @project_id, @doc_id, @updates, (error) =>
				throw error if error?
				TrackChangesClient.getDiff @project_id, @doc_id, @fromVersion, @toVersion, (error, diff) =>
					throw error if error?
					@diff = diff.diff
					done()
		return null

	afterEach () ->
		MockDocUpdaterApi.getDoc.restore()
		MockWebApi.getUserInfo.restore()
		return null

	it "should return the diff", ->
		expect(@diff).to.deep.equal @expected_diff

	it "should get the doc from the doc updater", ->
		MockDocUpdaterApi.getDoc
			.calledWith(@project_id, @doc_id)
			.should.equal true
		return null
