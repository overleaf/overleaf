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
MockWebApi = require "./helpers/MockWebApi"

describe "Getting updates", ->
	before (done) ->
		@now = Date.now()
		@to = @now
		@user_id = ObjectId().toString()
		@deleted_user_id = 'deleted_user'
		@doc_id = ObjectId().toString()
		@project_id = ObjectId().toString()

		@minutes = 60 * 1000
		@hours = 60 * @minutes

		MockWebApi.projects[@project_id] =
			features:
				versioning: true

		MockWebApi.users[@user_id] = @user =
			email: "user@sharelatex.com"
			first_name: "Leo"
			last_name: "Lion"
			id: @user_id
		sinon.spy MockWebApi, "getUserInfo"

		@updates = []
		for i in [0..9]
			@updates.push {
				op: [{ i: "a", p: 0 }]
				meta: { ts: @now - (9 - i) * @hours - 2 * @minutes, user_id: @user_id }
				v: 2 * i + 1
			}
			@updates.push {
				op: [{ i: "b", p: 0 }]
				meta: { ts: @now - (9 - i) * @hours, user_id: @user_id }
				v: 2 * i + 2
			}
		@updates[0].meta.user_id = @deleted_user_id

		TrackChangesApp.ensureRunning =>
			TrackChangesClient.pushRawUpdates @project_id, @doc_id, @updates, (error) =>
				throw error if error?
				done()
		return null

	after: () ->
		MockWebApi.getUserInfo.restore()
		return null

	describe "getting updates up to the limit", ->
		before (done) ->
			TrackChangesClient.getUpdates @project_id, { before: @to + 1, min_count: 3 }, (error, body) =>
				throw error if error?
				@updates = body.updates
				done()
			return null

		it "should fetch the user details from the web api", ->
			MockWebApi.getUserInfo
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
					start_ts: @to - 1 * @hours - 2 * @minutes
					end_ts: @to - 1 * @hours
					users: [@user]
			}, {
				docs: docs3
				meta:
					start_ts: @to - 2 * @hours - 2 * @minutes
					end_ts: @to - 2 * @hours
					users: [@user]
			}]

	describe "getting updates beyond the end of the database", ->
		before (done) ->
			TrackChangesClient.getUpdates @project_id, { before: @to - 8 * @hours + 1, min_count: 30 }, (error, body) =>
				throw error if error?
				@updates = body.updates
				done()
			return null

		it "should return as many updates as it can", ->
			docs1 = {}
			docs1[@doc_id] = toV: 4, fromV: 3
			docs2 = {}
			docs2[@doc_id] = toV: 2, fromV: 1
			expect(@updates).to.deep.equal [{
				docs: docs1
				meta:
					start_ts: @to - 8 * @hours - 2 * @minutes
					end_ts: @to - 8 * @hours
					users: [@user]
			}, {
				docs: docs2
				meta:
					start_ts: @to - 9 * @hours - 2 * @minutes
					end_ts: @to - 9 * @hours
					users: [@user, null]
			}]
