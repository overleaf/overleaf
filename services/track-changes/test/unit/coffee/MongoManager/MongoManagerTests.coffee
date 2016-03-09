sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/MongoManager.js"
packModulePath = "../../../../app/js/PackManager.js"
SandboxedModule = require('sandboxed-module')
{ObjectId} = require("mongojs")
tk = require "timekeeper"

describe "MongoManager", ->
	beforeEach ->
		tk.freeze(new Date())
		@MongoManager = SandboxedModule.require modulePath, requires:
			"./mongojs" : { db: @db = {}, ObjectId: ObjectId }
			"./PackManager" : @PackManager = {}
		@callback = sinon.stub()
		@doc_id = ObjectId().toString()
		@project_id = ObjectId().toString()

	afterEach ->
		tk.reset()

	describe "getLastCompressedUpdate", ->
		beforeEach ->
			@update = "mock-update"
			@db.docHistory = {}
			@db.docHistory.find = sinon.stub().returns @db.docHistory
			@db.docHistory.findOne = sinon.stub().returns @db.docHistory
			@db.docHistory.sort = sinon.stub().returns @db.docHistory
			@db.docHistory.limit = sinon.stub().returns @db.docHistory
			@db.docHistory.toArray = sinon.stub().callsArgWith(0, null, [@update])

			@MongoManager.getLastCompressedUpdate @doc_id, @callback

		it "should find the updates for the doc", ->
			@db.docHistory.find
				.calledWith(doc_id: ObjectId(@doc_id))
				.should.equal true

		it "should limit to one result", ->
			@db.docHistory.limit
				.calledWith(1)
				.should.equal true

		it "should sort in descending version order", ->
			@db.docHistory.sort
				.calledWith(v: -1)
				.should.equal true

		it "should call the call back with the update", ->
			@callback.calledWith(null, @update).should.equal true


	describe "peekLastCompressedUpdate", ->
		describe "when there is no last update", ->
			beforeEach ->
				@PackManager.getLastPackFromIndex =  sinon.stub().callsArgWith(1, null, null)
				@MongoManager.getLastCompressedUpdate = sinon.stub().callsArgWith(1, null, null)
				@MongoManager.peekLastCompressedUpdate @doc_id, @callback

			it "should get the last update", ->
				@MongoManager.getLastCompressedUpdate
					.calledWith(@doc_id)
					.should.equal true

			it "should call the callback with no update", ->
				@callback.calledWith(null, null).should.equal true

		describe "when there is an update", ->
			beforeEach ->
				@update = { _id: Object() }
				@MongoManager.getLastCompressedUpdate = sinon.stub().callsArgWith(1, null, @update)
				@MongoManager.peekLastCompressedUpdate @doc_id, @callback

			it "should get the last update", ->
				@MongoManager.getLastCompressedUpdate
					.calledWith(@doc_id)
					.should.equal true

			it "should call the callback with the update", ->
				@callback.calledWith(null, @update).should.equal true

		describe "when there is a last update in S3", ->
			beforeEach ->
				@update = { _id: Object(), v: 12345, v_end: 12345, inS3:true}
				@PackManager.getLastPackFromIndex =  sinon.stub().callsArgWith(1, null, @update)
				@MongoManager.getLastCompressedUpdate = sinon.stub().callsArgWith(1, null)
				@MongoManager.peekLastCompressedUpdate @doc_id, @callback

			it "should get the last update", ->
				@MongoManager.getLastCompressedUpdate
					.calledWith(@doc_id)
					.should.equal true

			it "should call the callback with a null update and the correct version", ->
				@callback.calledWith(null, null, @update.v_end).should.equal true


	describe "backportProjectId", ->
		beforeEach ->
			@db.docHistory =
				update: sinon.stub().callsArg(3)
			@MongoManager.backportProjectId @project_id, @doc_id, @callback

		it "should insert the project_id into all entries for the doc_id which don't have it set", ->
			@db.docHistory.update
				.calledWith({
					doc_id: ObjectId(@doc_id)
					project_id: { $exists: false }
				}, {
					$set: { project_id: ObjectId(@project_id) }
				}, {
					multi: true
				})
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "getProjectMetaData", ->
		beforeEach ->
			@metadata = { "mock": "metadata" }
			@db.projectHistoryMetaData =
				find: sinon.stub().callsArgWith(1, null, [@metadata])
			@MongoManager.getProjectMetaData @project_id, @callback

		it "should look up the meta data in the db", ->
			@db.projectHistoryMetaData.find
				.calledWith({ project_id: ObjectId(@project_id) })
				.should.equal true

		it "should return the metadata", ->
			@callback.calledWith(null, @metadata).should.equal true

	describe "setProjectMetaData", ->
		beforeEach ->
			@metadata = { "mock": "metadata" }
			@db.projectHistoryMetaData =
				update: sinon.stub().callsArgWith(3, null, [@metadata])
			@MongoManager.setProjectMetaData @project_id, @metadata, @callback

		it "should upsert the metadata into the DB", ->
			@db.projectHistoryMetaData.update
				.calledWith({
					project_id: ObjectId(@project_id)
				}, {
					$set: @metadata
				}, {
					upsert: true
				})
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

