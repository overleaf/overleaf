sinon = require "sinon"
chai = require("chai")
chai.should()
expect = chai.expect
mongojs = require "../../../app/js/mongojs"
db = mongojs.db
ObjectId = mongojs.ObjectId
Settings = require "settings-sharelatex"
request = require "request"
rclient = require("redis").createClient() # Only works locally for now

TrackChangesClient = require "./helpers/TrackChangesClient"
MockDocStoreApi = require "./helpers/MockDocStoreApi"
MockWebApi = require "./helpers/MockWebApi"

describe "Archiving updates", ->
	before (done) ->
		@now = Date.now()
		@to = @now
		@user_id = ObjectId().toString()
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
		sinon.spy MockWebApi, "getUser"

		MockDocStoreApi.docs[@doc_id] = @doc = 
			_id: @doc_id
			project_id: @project_id
		sinon.spy MockDocStoreApi, "getAllDoc"

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

		TrackChangesClient.pushRawUpdates @project_id, @doc_id, @updates, (error) =>
			throw error if error?
			TrackChangesClient.flushDoc @project_id, @doc_id, (error) ->
				throw error if error?
				done()

	after: () ->
		MockWebApi.getUser.restore()

	describe "archiving a doc's updates", ->
		before (done) ->
			
			TrackChangesClient.archiveProject @project_id, (error) ->
				throw error if error?
				done()

		it "should remain one doc", (done) ->
			db.docHistory.count { doc_id: ObjectId(@doc_id) }, (error, count) ->
				throw error if error?
				count.should.equal 1
				done()

		it "should remained doc marked as inS3", (done) ->
			db.docHistory.findOne { doc_id: ObjectId(@doc_id) }, (error, doc) ->
				throw error if error?
				doc.inS3.should.equal true
				done()

		it "should remained doc have last version", (done) ->
			db.docHistory.findOne { doc_id: ObjectId(@doc_id) }, (error, doc) ->
				throw error if error?
				doc.v.should.equal 20
				done()