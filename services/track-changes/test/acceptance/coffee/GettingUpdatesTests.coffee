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

		TrackChangesClient.pushRawUpdates @project_id, @doc_id, @updates, (error) =>
			throw error if error?
			done()

	after: () ->
		MockWebApi.getUser.restore()

	describe "getting updates up to the limit", ->
		before (done) ->
			TrackChangesClient.getUpdates @project_id, { before: @to + 1, min_count: 3 }, (error, body) =>
				throw error if error?
				@updates = body.updates
				done()

		it "should fetch the user details from the web api", ->
			MockWebApi.getUser
				.calledWith(@user_id)
				.should.equal true

		it "should return at least the min_count number of summarized updates", ->
			docs1 = {}
			docs1[@doc_id] = toV: 20, fromV: 19
			docs2 = {}
			docs2[@doc_id] = toV: 18, fromV: 17
			docs3 = {}
			docs3[@doc_id] = toV: 16, fromV: 15
			expect(@updates.slice(0,3)).to.deep.equal [{
				docs: docs1
				meta:
					start_ts: @to - 2 * @minutes
					end_ts: @to
					users: [@user]
			}, {
				docs: docs2
				meta:
					start_ts: @to - 1 * @days - 2 * @minutes
					end_ts: @to - 1 * @days
					users: [@user]
			}, {
				docs: docs3
				meta:
					start_ts: @to - 2 * @days - 2 * @minutes
					end_ts: @to - 2 * @days
					users: [@user]
			}]


	describe "getting updates beyond the end of the database", ->
		before (done) ->
			TrackChangesClient.getUpdates @project_id, { before: @to - 8 * @days + 1, min_count: 30 }, (error, body) =>
				throw error if error?
				@updates = body.updates
				done()

		it "should return as many updates as it can", ->
			docs1 = {}
			docs1[@doc_id] = toV: 4, fromV: 3
			docs2 = {}
			docs2[@doc_id] = toV: 2, fromV: 1
			expect(@updates).to.deep.equal [{
				docs: docs1
				meta:
					start_ts: @to - 8 * @days - 2 * @minutes
					end_ts: @to - 8 * @days
					users: [@user]
			}, {
				docs: docs2
				meta:
					start_ts: @to - 9 * @days - 2 * @minutes
					end_ts: @to - 9 * @days
					users: [@user]
			}]

