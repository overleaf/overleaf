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

describe "Restoring a version", ->
	before (done) ->
		sinon.spy MockDocUpdaterApi, "setDoc"

		@now = Date.now()
		@user_id = ObjectId().toString()
		@doc_id = ObjectId().toString()
		@project_id = ObjectId().toString()
		MockWebApi.projects[@project_id] = features: versioning: true
		
		minutes = 60 * 1000

		@updates = [{
			op: [{ i: "one ", p: 0 }]
			meta: { ts: @now - 6 * minutes, user_id: @user_id }
			v: 3
		}, {
			op: [{ i: "two ", p: 4 }]
			meta: { ts: @now - 4 * minutes, user_id: @user_id }
			v: 4
		}, {
			op: [{ i: "three ", p: 8 }]
			meta: { ts: @now - 2 * minutes, user_id: @user_id }
			v: 5
		}, {
			op: [{ i: "four", p: 14 }]
			meta: { ts: @now, user_id: @user_id }
			v: 6
		}]
		@lines = ["one two three four"]
		@restored_lines = ["one two "]
		@beforeVersion = 5

		MockWebApi.users[@user_id] = @user =
			email: "user@sharelatex.com"
			first_name: "Leo"
			last_name: "Lion"
			id: @user_id

		MockDocUpdaterApi.docs[@doc_id] =
			lines: @lines
			version: 7

		TrackChangesApp.ensureRunning =>
			TrackChangesClient.pushRawUpdates @project_id, @doc_id, @updates, (error) =>
				throw error if error?
				TrackChangesClient.restoreDoc @project_id, @doc_id, @beforeVersion, @user_id, (error) =>
					throw error if error?
					done()
		return null

	after () ->
		MockDocUpdaterApi.setDoc.restore()
		return null

	it "should set the doc in the doc updater", ->
		MockDocUpdaterApi.setDoc
			.calledWith(@project_id, @doc_id, @restored_lines, @user_id, true)
			.should.equal true
		return null
