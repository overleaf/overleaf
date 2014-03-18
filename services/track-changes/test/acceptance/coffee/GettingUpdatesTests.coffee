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
		@days = 24 * 60 * @minutes

		MockWebApi.users[@user_id] = @user =
			email: "user@sharelatex.com"
			first_name: "Leo"
			last_name: "Lion"
			id: @user_id
		sinon.spy MockWebApi, "getUser"

		@updates = []
		for i in [0..9]
			@updates.push {
				op: [{ i: "a", p: 0 }]
				meta: { ts: @now - (9 - i) * @days - 2 * @minutes, user_id: @user_id }
				v: 2 * i + 1
			}
			@updates.push {
				op: [{ i: "b", p: 0 }]
				meta: { ts: @now - (9 - i) * @days, user_id: @user_id }
				v: 2 * i + 2
			}

		TrackChangesClient.pushRawUpdates @doc_id, @updates, (error) =>
			throw error if error?
			done()

	after: () ->
		MockWebApi.getUser.restore()

	describe "getting updates up to the limit", ->
		before (done) ->
			TrackChangesClient.getUpdates @project_id, @doc_id, { to: 20, limit: 3 }, (error, body) =>
				throw error if error?
				@updates = body.updates
				done()

		it "should fetch the user details from the web api", ->
			MockWebApi.getUser
				.calledWith(@user_id)
				.should.equal true

		it "should return the same number of summarized updates as the limit", ->
			expect(@updates).to.deep.equal [{
				meta:
					start_ts: @to - 2 * @minutes
					end_ts: @to
					users: [@user]
				toV: 20
				fromV: 19
			}, {
				meta:
					start_ts: @to - 1 * @days - 2 * @minutes
					end_ts: @to - 1 * @days
					users: [@user]
				toV: 18
				fromV: 17
			}, {
				meta:
					start_ts: @to - 2 * @days - 2 * @minutes
					end_ts: @to - 2 * @days
					users: [@user]
				toV: 16
				fromV: 15
			}]


	describe "getting updates beyond the end of the database", ->
		before (done) ->
			TrackChangesClient.getUpdates @project_id, @doc_id, { to: 4, limit: 30 }, (error, body) =>
				throw error if error?
				@updates = body.updates
				done()

		it "should return as many updates as it can", ->
			expect(@updates).to.deep.equal [{
				meta:
					start_ts: @to - 8 * @days - 2 * @minutes
					end_ts: @to - 8 * @days
					users: [@user]
				toV: 4
				fromV: 3
			}, {
				meta:
					start_ts: @to - 9 * @days - 2 * @minutes
					end_ts: @to - 9 * @days
					users: [@user]
				toV: 2
				fromV: 1
			}]

