sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/MongoManager.js"
SandboxedModule = require('sandboxed-module')
{ObjectId} = require("mongojs")

describe "MongoManager", ->
	beforeEach ->
		@MongoManager = SandboxedModule.require modulePath, requires:
			"./mongojs" : { db: @db = {}, ObjectId: ObjectId }
		@callback = sinon.stub()
		@doc_id = ObjectId().toString()
		@project_id = ObjectId().toString()

	describe "getLastCompressedUpdate", ->
		beforeEach ->
			@update = "mock-update"
			@db.docHistory = {}
			@db.docHistory.find = sinon.stub().returns @db.docHistory
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

	describe "deleteCompressedUpdate", ->
		beforeEach ->
			@update_id = ObjectId().toString()
			@db.docHistory = 
				remove: sinon.stub().callsArg(1)
			@MongoManager.deleteCompressedUpdate(@update_id, @callback)

		it "should remove the update", ->
			@db.docHistory.remove
				.calledWith(_id: ObjectId(@update_id))
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "popLastCompressedUpdate", ->
		describe "when there is no last update", ->
			beforeEach ->
				@MongoManager.getLastCompressedUpdate = sinon.stub().callsArgWith(1, null, null)
				@MongoManager.deleteCompressedUpdate = sinon.stub()
				@MongoManager.popLastCompressedUpdate @doc_id, @callback

			it "should get the last update", ->
				@MongoManager.getLastCompressedUpdate
					.calledWith(@doc_id)
					.should.equal true

			it "should not try to delete the last update", ->
				@MongoManager.deleteCompressedUpdate.called.should.equal false

			it "should call the callback with no update", ->
				@callback.calledWith(null, null).should.equal true

		describe "when there is an update", ->
			beforeEach ->
				@update = { _id: Object() }
				@MongoManager.getLastCompressedUpdate = sinon.stub().callsArgWith(1, null, @update)
				@MongoManager.deleteCompressedUpdate = sinon.stub().callsArgWith(1, null)
				@MongoManager.popLastCompressedUpdate @doc_id, @callback

			it "should get the last update", ->
				@MongoManager.getLastCompressedUpdate
					.calledWith(@doc_id)
					.should.equal true

			it "should delete the last update", ->
				@MongoManager.deleteCompressedUpdate
					.calledWith(@update._id)
					.should.equal true

			it "should call the callback with the update", ->
				@callback.calledWith(null, @update).should.equal true

	describe "insertCompressedUpdate", ->
		beforeEach ->
			@update = { op: "op", meta: "meta", v: "v"}
			@db.docHistory =
				insert: sinon.stub().callsArg(1)
			@MongoManager.insertCompressedUpdate @project_id, @doc_id, @update, @callback

		it "should insert the update", ->
			@db.docHistory.insert
				.calledWith({
					project_id: ObjectId(@project_id),
					doc_id: ObjectId(@doc_id),
					op: @update.op,
					meta: @update.meta,
					v: @update.v
				})
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "insertCompressedUpdates", ->
		beforeEach (done) ->
			@updates = [ "mock-update-1", "mock-update-2" ]
			@MongoManager.insertCompressedUpdate = sinon.stub().callsArg(3)
			@MongoManager.insertCompressedUpdates @project_id, @doc_id, @updates, (args...) =>
				@callback(args...)
				done()

		it "should insert each update", ->
			for update in @updates
				@MongoManager.insertCompressedUpdate
					.calledWith(@project_id, @doc_id, update)
					.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "getDocUpdates", ->
		beforeEach ->
			@updates = ["mock-update"]
			@db.docHistory = {}
			@db.docHistory.find = sinon.stub().returns @db.docHistory
			@db.docHistory.sort = sinon.stub().returns @db.docHistory
			@db.docHistory.limit = sinon.stub().returns @db.docHistory
			@db.docHistory.toArray = sinon.stub().callsArgWith(0, null, @updates)

			@from = 42
			@to   = 55

		describe "with a to version", ->
			beforeEach ->
				@MongoManager.getDocUpdates @doc_id, from: @from, to: @to, @callback

			it "should find the all updates between the to and from versions", ->
				@db.docHistory.find
					.calledWith({
						doc_id: ObjectId(@doc_id)
						v: { $gte: @from, $lte: @to }
					})
					.should.equal true

			it "should sort in descending version order", ->
				@db.docHistory.sort
					.calledWith("v": -1)
					.should.equal true

			it "should not limit the results", ->
				@db.docHistory.limit
					.called.should.equal false

			it "should call the call back with the updates", ->
				@callback.calledWith(null, @updates).should.equal true

		describe "without a to version", ->
			beforeEach ->
				@MongoManager.getDocUpdates @doc_id, from: @from, @callback

			it "should find the all updates after the from version", ->
				@db.docHistory.find
					.calledWith({
						doc_id: ObjectId(@doc_id)
						v: { $gte: @from }
					})
					.should.equal true

			it "should call the call back with the updates", ->
				@callback.calledWith(null, @updates).should.equal true

		describe "with a limit", ->
			beforeEach ->
				@MongoManager.getDocUpdates @doc_id, from: @from, limit: @limit = 10, @callback

			it "should limit the results", ->
				@db.docHistory.limit
					.calledWith(@limit)
					.should.equal true


	describe "getDocUpdates", ->
		beforeEach ->
			@updates = ["mock-update"]
			@db.docHistory = {}
			@db.docHistory.find = sinon.stub().returns @db.docHistory
			@db.docHistory.sort = sinon.stub().returns @db.docHistory
			@db.docHistory.limit = sinon.stub().returns @db.docHistory
			@db.docHistory.toArray = sinon.stub().callsArgWith(0, null, @updates)

			@before = Date.now()

		describe "with a before timestamp", ->
			beforeEach ->
				@MongoManager.getProjectUpdates @project_id, before: @before, @callback

			it "should find the all updates before the timestamp", ->
				@db.docHistory.find
					.calledWith({
						project_id: ObjectId(@project_id)
						"meta.end_ts": { $lt: @before }
					})
					.should.equal true

			it "should sort in descending version order", ->
				@db.docHistory.sort
					.calledWith("meta.end_ts": -1)
					.should.equal true

			it "should not limit the results", ->
				@db.docHistory.limit
					.called.should.equal false

			it "should call the call back with the updates", ->
				@callback.calledWith(null, @updates).should.equal true

		describe "without a before timestamp", ->
			beforeEach ->
				@MongoManager.getProjectUpdates @project_id, {}, @callback

			it "should find the all updates", ->
				@db.docHistory.find
					.calledWith({
						project_id: ObjectId(@project_id)
					})
					.should.equal true

			it "should call the call back with the updates", ->
				@callback.calledWith(null, @updates).should.equal true

		describe "with a limit", ->
			beforeEach ->
				@MongoManager.getProjectUpdates @project_id, before: @before, limit: @limit = 10, @callback

			it "should limit the results", ->
				@db.docHistory.limit
					.calledWith(@limit)
					.should.equal true

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

	describe "deleteOldProjectUpdates", ->
		beforeEach ->
			@before = Date.now() - 10000
			@db.docHistory =
				remove: sinon.stub().callsArg(1)
			@MongoManager.deleteOldProjectUpdates @project_id, @before, @callback

		it "should delete updates before the 'before' time", ->
			@db.docHistory.remove
				.calledWith({
					project_id: ObjectId(@project_id)
					"meta.end_ts": { "$lt": @before }
				})
				.should.equal true

		it "should return the callback", ->
			@callback.called.should.equal true
