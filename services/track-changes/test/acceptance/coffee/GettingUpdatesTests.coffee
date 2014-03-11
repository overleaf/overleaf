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
	before ->
		@now = Date.now()
		@to = @now
		@user_id = ObjectId().toString()

		@minutes = 60 * 1000

		MockWebApi.users[@user_id] = @user =
			email: "user@sharelatex.com"
			first_name: "Leo"
			last_name: "Lion"
			id: @user_id
		sinon.spy MockWebApi, "getUser"

	after: () ->
		MockWebApi.getUser.restore()

	describe "getting updates in the middle", ->
		before (done) ->
			@doc_id = ObjectId().toString()
			@project_id = ObjectId().toString()
			@updates = [{
				op: [{ i: "one ", p: 0 }]
				meta: { ts: @to - 20 * @minutes, user_id: @user_id }
				v: 3
			}, {
				op: [{ i: "two ", p: 4 }]
				meta: { ts: @to - 10 * @minutes }
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

		it "should fetch the user details from the web api", ->
			MockWebApi.getUser
				.calledWith(@user_id)
				.should.equal true

		it "should return the updates", ->
			expect(@updates).to.deep.equal [{
				meta:
					start_ts: @to
					end_ts: @to
					users: [@user]
				fromV: 5
				toV: 5
			}, {
				meta:
					users: []
					start_ts: @to - 10 * @minutes
					end_ts: @to - 10 * @minutes
				toV: 4
				fromV: 4
			}]

	describe "getting updates that should be combined", ->
		before (done) ->
			@doc_id = ObjectId().toString()
			@project_id = ObjectId().toString()
			@updates = [{
				op: [{ i: "two ", p: 4 }]
				meta: { ts: @to - 2 * @minutes, user_id: @user_id }
				v: 4
			}, {
				op: [{ i: "three ", p: 8 }]
				meta: { ts: @to, user_id: @user_id }
				v: @toVersion = 5
			}]

			TrackChangesClient.pushRawUpdates @doc_id, @updates, (error) =>
				throw error if error?
				TrackChangesClient.getUpdates @project_id, @doc_id, { to: @toVersion, limit: 2 }, (error, body) =>
					throw error if error?
					@updates = body.updates
					done()

		it "should return the updates", ->
			expect(@updates).to.deep.equal [{
				meta:
					start_ts: @to - 2 * @minutes
					end_ts: @to
					users: [@user]
				fromV: 4
				toV: 5
			}]
