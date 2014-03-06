sinon = require "sinon"
chai = require("chai")
chai.should()
expect = chai.expect
mongojs = require "../../../app/js/mongojs"
db = mongojs.db
ObjectId = mongojs.ObjectId
Settings = require "settings-sharelatex"

TrackChangesClient = require "./helpers/TrackChangesClient"
MockWebApi = require "./helpers/MockWebApi"

describe "Getting updates", ->
	before (done) ->
		@now = Date.now()
		@to = @now
		@user_id = ObjectId().toString()
		@doc_id = ObjectId().toString()
		@project_id = ObjectId().toString()

		@minutes = 60 * 1000

		MockWebApi.users[@user_id] = @user =
			email: "user@sharelatex.com"
			first_name: "Leo"
			last_name: "Lion"
			id: @user_id
		sinon.spy MockWebApi, "getUser"

		@updates = [{
			op: [{ i: "one ", p: 0 }]
			meta: { ts: @to - 4 * @minutes, user_id: @user_id }
			v: 3
		}, {
			op: [{ i: "two ", p: 4 }]
			meta: { ts: @to - 2 * @minutes, user_id: @user_id }
			v: 4
		}, {
			op: [{ i: "three ", p: 8 }]
			meta: { ts: @to, user_id: @user_id }
			v: @toVersion = 5
		}, {
			op: [{ i: "four", p: 14 }]
			meta: { ts: @to + 2 * @minutes, user_id: @user_id }
			v: 6
		}]

		TrackChangesClient.pushRawUpdates @doc_id, @updates, (error) =>
			throw error if error?
			TrackChangesClient.getUpdates @project_id, @doc_id, { to: @toVersion, limit: 2 }, (error, body) =>
				throw error if error?
				@updates = body.updates
				done()

	after: () ->
		MockWebApi.getUser.restore()

	it "should fetch the user details from the web api", ->
		MockWebApi.getUser
			.calledWith(@user_id)
			.should.equal true

	it "should return the updates", ->
		expect(@updates).to.deep.equal [{
			meta:
				start_ts: @to
				end_ts: @to
				user: @user
			v: 5
		}, {
			meta:
				start_ts: @to - 2 * @minutes
				end_ts: @to - 2 * @minutes
				user: @user
			v: 4
		}]
