sinon = require "sinon"
chai = require("chai")
chai.should()
expect = chai.expect
mongojs = require "../../../app/js/mongojs"
db = mongojs.db
ObjectId = mongojs.ObjectId
Settings = require "settings-sharelatex"
request = require "request"
rclient = require("redis").createClient(Settings.redis.history) # Only works locally for now

TrackChangesApp = require "./helpers/TrackChangesApp"
TrackChangesClient = require "./helpers/TrackChangesClient"
MockDocStoreApi = require "./helpers/MockDocStoreApi"
MockWebApi = require "./helpers/MockWebApi"

describe "Archiving updates", ->
	before (done) ->
		if Settings?.trackchanges?.s3?.key.length < 1
			message = "s3 keys not setup, this test setup will fail"
			return done(message)

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
		sinon.spy MockWebApi, "getProjectDetails"

		MockWebApi.users[@user_id] = @user =
			email: "user@sharelatex.com"
			first_name: "Leo"
			last_name: "Lion"
			id: @user_id
		sinon.spy MockWebApi, "getUserInfo"

		MockDocStoreApi.docs[@doc_id] = @doc = 
			_id: @doc_id
			project_id: @project_id
		sinon.spy MockDocStoreApi, "getAllDoc"

		@updates = []
		for i in [0..512+10]
			@updates.push {
				op: [{ i: "a", p: 0 }]
				meta: { ts: @now + (i-2048) * @hours, user_id: @user_id }
				v: 2 * i + 1
			}
			@updates.push {
				op: [{ i: "b", p: 0 }]
				meta: { ts: @now + (i-2048) * @hours + 10*@minutes, user_id: @user_id }
				v: 2 * i + 2
			}
		TrackChangesApp.ensureRunning =>
			TrackChangesClient.pushRawUpdates @project_id, @doc_id, @updates, (error) =>
				throw error if error?
				TrackChangesClient.flushDoc @project_id, @doc_id, (error) ->
					throw error if error?
					done()
		return null

	after (done) ->
		MockWebApi.getUserInfo.restore()
		db.docHistory.remove {project_id: ObjectId(@project_id)}, () =>
			db.docHistoryIndex.remove {project_id: ObjectId(@project_id)}, () =>
				TrackChangesClient.removeS3Doc @project_id, @doc_id, done

	describe "archiving a doc's updates", ->
		before (done) ->
			TrackChangesClient.pushDocHistory @project_id, @doc_id, (error) ->
				throw error if error?
				done()
			return null

		it "should have one cached pack", (done) ->
			db.docHistory.count { doc_id: ObjectId(@doc_id), expiresAt:{$exists:true}}, (error, count) ->
				throw error if error?
				count.should.equal 1
				done()

		it "should have one remaining pack after cache is expired", (done) ->
			db.docHistory.remove {
				doc_id: ObjectId(@doc_id),
				expiresAt:{$exists:true}
			}, (err, result) =>
				throw error if error?
				db.docHistory.count { doc_id: ObjectId(@doc_id)}, (error, count) ->
					throw error if error?
					count.should.equal 1
					done()

		it "should have a docHistoryIndex entry marked as inS3", (done) ->
			db.docHistoryIndex.findOne { _id: ObjectId(@doc_id) }, (error, index) ->
				throw error if error?
				index.packs[0].inS3.should.equal true
				done()

		it "should have a docHistoryIndex entry with the last version", (done) ->
			db.docHistoryIndex.findOne { _id: ObjectId(@doc_id) }, (error, index) ->
				throw error if error?
				index.packs[0].v_end.should.equal 1024
				done()

		it "should store 1024 doc changes in S3 in one pack", (done) ->
			db.docHistoryIndex.findOne { _id: ObjectId(@doc_id) }, (error, index) =>
				throw error if error?
				pack_id = index.packs[0]._id
				TrackChangesClient.getS3Doc @project_id, @doc_id, pack_id, (error, doc) =>
					doc.n.should.equal 1024
					doc.pack.length.should.equal 1024
					done()

	describe "unarchiving a doc's updates", ->
		before (done) ->
			TrackChangesClient.pullDocHistory @project_id, @doc_id, (error) ->
				throw error if error?
				done()
			return null

		it "should restore both packs", (done) ->
			db.docHistory.count { doc_id: ObjectId(@doc_id) }, (error, count) ->
				throw error if error?
				count.should.equal 2
				done()
