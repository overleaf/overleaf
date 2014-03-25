sinon = require "sinon"
chai = require("chai")
chai.should()
expect = chai.expect
mongojs = require "../../../app/js/mongojs"
ObjectId = mongojs.ObjectId
Settings = require "settings-sharelatex"
request = require "request"
rclient = require("redis").createClient() # Only works locally for now

TrackChangesClient = require "./helpers/TrackChangesClient"

describe "Flushing updates", ->
	describe "flushing a doc's updates", ->
		before (done) ->
			@project_id = ObjectId().toString()
			@doc_id = ObjectId().toString()
			@user_id = ObjectId().toString()
			TrackChangesClient.pushRawUpdates @project_id, @doc_id, [{
				op: [{ i: "f", p: 3 }]
				meta: { ts: Date.now(), user_id: @user_id }
				v: 3
			}], (error) =>
				throw error if error?
				TrackChangesClient.flushDoc @project_id, @doc_id, (error) ->
					throw error if error?
					done()

		it "should flush the op into mongo", (done) ->
			TrackChangesClient.getCompressedUpdates @doc_id, (error, updates) ->
				expect(updates[0].op).to.deep.equal [{
					p: 3, i: "f"
				}]
				done()

	describe "flushing a project's updates", ->
		before (done) ->
			@project_id = ObjectId().toString()
			@doc_id = ObjectId().toString()
			@user_id = ObjectId().toString()
			TrackChangesClient.pushRawUpdates @project_id, @doc_id, [{
				op: [{ i: "f", p: 3 }]
				meta: { ts: Date.now(), user_id: @user_id }
				v: 3
			}], (error) =>
				throw error if error?
				TrackChangesClient.flushProject @project_id, (error) ->
					throw error if error?
					done()

		it "should flush the op into mongo", (done) ->
			TrackChangesClient.getCompressedUpdates @doc_id, (error, updates) ->
				expect(updates[0].op).to.deep.equal [{
					p: 3, i: "f"
				}]
				done()
