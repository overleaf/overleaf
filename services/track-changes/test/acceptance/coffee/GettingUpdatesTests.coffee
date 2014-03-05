sinon = require "sinon"
chai = require("chai")
chai.should()
expect = chai.expect
mongojs = require "../../../app/js/mongojs"
db = mongojs.db
ObjectId = mongojs.ObjectId
Settings = require "settings-sharelatex"

TrackChangesClient = require "./helpers/TrackChangesClient"

describe "Getting updates", ->
	before (done) ->
		@now = Date.now()
		@to = @now
		@user_id = ObjectId().toString()
		@doc_id = ObjectId().toString()
		@project_id = ObjectId().toString()

		@minutes = 60 * 1000

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
			v: 5
		}, {
			op: [{ i: "four", p: 14 }]
			meta: { ts: @to + 2 * @minutes, user_id: @user_id }
			v: 6
		}]

		TrackChangesClient.pushRawUpdates @doc_id, @updates, (error) =>
			throw error if error?
			TrackChangesClient.getUpdates @project_id, @doc_id, { to: @to, limit: 2 }, (error, body) =>
				throw error if error?
				@updates = body.updates
				done()

	it "should return the diff", ->
		expect(@updates).to.deep.equal [{
			meta:
				start_ts: @to
				end_ts: @to
				user_id: @user_id
		}, {
			meta:
				start_ts: @to - 2 * @minutes
				end_ts: @to - 2 * @minutes
				user_id: @user_id
		}]
