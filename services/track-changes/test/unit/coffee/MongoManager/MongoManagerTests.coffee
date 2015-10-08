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
			"./PackManager" : SandboxedModule.require packModulePath, requires:
				"./LockManager" : {}
				"./mongojs": {db: bson: BSON = sinon.stub(), ObjectId}
				"logger-sharelatex": {}
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
				@update = { _id: Object(), v: 12345, inS3: true }
				@MongoManager.getLastCompressedUpdate = sinon.stub().callsArgWith(1, null, @update)
				@MongoManager.peekLastCompressedUpdate @doc_id, @callback

			it "should get the last update", ->
				@MongoManager.getLastCompressedUpdate
					.calledWith(@doc_id)
					.should.equal true

			it "should call the callback with a null update and the correct version", ->
				@callback.calledWith(null, null, @update.v).should.equal true


	describe "insertCompressedUpdate", ->
		beforeEach ->
			@update = { op: "op", meta: "meta", v: "v"}
			@db.docHistory =
				insert: sinon.stub().callsArg(1)

		describe "temporarly", ->
			beforeEach ->
				@MongoManager.insertCompressedUpdate @project_id, @doc_id, @update, true, @callback

			it "should insert the update with a expiresAt field one week away", ->
				@db.docHistory.insert
					.calledWith({
						project_id: ObjectId(@project_id),
						doc_id: ObjectId(@doc_id),
						op: @update.op,
						meta: @update.meta,
						v: @update.v
						expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
					})
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "permanenty", ->
			beforeEach ->
				@MongoManager.insertCompressedUpdate @project_id, @doc_id, @update, false, @callback

			it "should insert the update with no expiresAt field", ->
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
			@MongoManager.insertCompressedUpdate = sinon.stub().callsArg(4)
			@MongoManager.insertCompressedUpdates @project_id, @doc_id, @updates, @temporary = true, (args...) =>
				@callback(args...)
				done()

		it "should insert each update", ->
			for update in @updates
				@MongoManager.insertCompressedUpdate
					.calledWith(@project_id, @doc_id, update, @temporary)
					.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "getDocUpdates", ->
		beforeEach ->
			@results = [
				{foo: "mock-update", v: 56, doc_id: 100, project_id: 1},
				{foo: "mock-update", v: 55, doc_id: 100, project_id: 1},
				{pack: [ {foo: "mock-update", v: 54, doc_id: 100, project_id: 1},
					{foo: "mock-update", v: 53, doc_id: 100, project_id: 1},
					{foo: "mock-update", v: 52, doc_id: 100, project_id: 1} ]
					, v: 52, doc_id: 100, project_id: 1},
				{foo: "mock-update", v: 42, doc_id: 100, project_id: 1},
				{foo: "mock-update", v: 41, doc_id: 100, project_id: 1}
			]
			@updates_between = [
				{foo: "mock-update", v: 55, doc_id: 100, project_id: 1},
				{foo: "mock-update", v: 54, doc_id: 100, project_id: 1},
				{foo: "mock-update", v: 53, doc_id: 100, project_id: 1},
				{foo: "mock-update", v: 52, doc_id: 100, project_id: 1},
				{foo: "mock-update", v: 42, doc_id: 100, project_id: 1}
			]
			@updates_after = [
				{foo: "mock-update", v: 56, doc_id: 100, project_id: 1},
				{foo: "mock-update", v: 55, doc_id: 100, project_id: 1},
				{foo: "mock-update", v: 54, doc_id: 100, project_id: 1},
				{foo: "mock-update", v: 53, doc_id: 100, project_id: 1},
				{foo: "mock-update", v: 52, doc_id: 100, project_id: 1},
				{foo: "mock-update", v: 42, doc_id: 100, project_id: 1}
			]
			@db.docHistory = {}
			@db.docHistory.find = sinon.stub().returns @db.docHistory
			@db.docHistory.sort = sinon.stub().returns @db.docHistory
			@db.docHistory.limit = sinon.stub().returns @db.docHistory
			@db.docHistory.toArray = sinon.stub().callsArgWith(0, null, @results)

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

			#it "should not limit the results", ->
			#	@db.docHistory.limit
			#		.called.should.equal false

			it "should call the call back with the results", ->
				@callback.calledWith(null, @updates_between).should.equal true

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
				@callback.calledWith(null, @updates_after).should.equal true

		describe "with a limit", ->
			beforeEach ->
				@MongoManager.getDocUpdates @doc_id, from: @from, limit: @limit = 10, @callback

			it "should limit the results", ->
				@db.docHistory.limit
					.calledWith(@limit)
					.should.equal true


	describe "getDocUpdates", ->
		beforeEach ->
			@results = [
				{foo: "mock-update", v: 56, meta: {end_ts: 110}, doc_id: 100, project_id: 1},
				{foo: "mock-update", v: 55, meta: {end_ts: 100}, doc_id: 100, project_id: 1},
				{pack: [
					{foo: "mock-update", v: 54, meta: {end_ts: 99}, doc_id: 300, project_id: 1},
					{foo: "mock-update", v: 53, meta: {end_ts: 98}, doc_id: 300, project_id: 1},
					{foo: "mock-update", v: 52, meta: {end_ts: 97}, doc_id: 300, project_id: 1}	]
					, v: 52, meta: {end_ts: 100}, doc_id: 300, project_id: 1},
				{pack: [
					{foo: "mock-update", v: 54, meta: {end_ts: 103}, doc_id: 200, project_id: 1},
					{foo: "mock-update", v: 53, meta: {end_ts: 101}, doc_id: 200, project_id: 1},
					{foo: "mock-update", v: 52, meta: {end_ts: 99}, doc_id: 200, project_id: 1}	]
					, v: 52, meta: {end_ts: 103}, doc_id: 200, project_id: 1},
				{foo: "mock-update", v: 42, meta:{end_ts: 90}, doc_id: 100, project_id: 1}
			]
			@updates_before = [
				{foo: "mock-update", v: 55, meta: {end_ts: 100}, doc_id: 100, project_id: 1},
				{foo: "mock-update", v: 52, meta: {end_ts: 99}, doc_id: 200, project_id: 1},
				{foo: "mock-update", v: 54, meta: {end_ts: 99}, doc_id: 300, project_id: 1},
				{foo: "mock-update", v: 53, meta: {end_ts: 98}, doc_id: 300, project_id: 1},
				{foo: "mock-update", v: 52, meta: {end_ts: 97}, doc_id: 300, project_id: 1},
				{foo: "mock-update", v: 42, meta: {end_ts: 90}, doc_id: 100, project_id: 1},
			]
			@updates_all = [
				{foo: "mock-update", v: 56, meta: {end_ts: 110}, doc_id: 100, project_id: 1},
				{foo: "mock-update", v: 54, meta: {end_ts: 103}, doc_id: 200, project_id: 1},
				{foo: "mock-update", v: 53, meta: {end_ts: 101}, doc_id: 200, project_id: 1},
				{foo: "mock-update", v: 55, meta: {end_ts: 100}, doc_id: 100, project_id: 1},
				{foo: "mock-update", v: 52, meta: {end_ts: 99}, doc_id: 200, project_id: 1},
				{foo: "mock-update", v: 54, meta: {end_ts: 99}, doc_id: 300, project_id: 1},
				{foo: "mock-update", v: 53, meta: {end_ts: 98}, doc_id: 300, project_id: 1},
				{foo: "mock-update", v: 52, meta: {end_ts: 97}, doc_id: 300, project_id: 1},
				{foo: "mock-update", v: 42, meta: {end_ts: 90}, doc_id: 100, project_id: 1}
			]


			@db.docHistory = {}
			@db.docHistory.find = sinon.stub().returns @db.docHistory
			@db.docHistory.sort = sinon.stub().returns @db.docHistory
			@db.docHistory.limit = sinon.stub().returns @db.docHistory
			@db.docHistory.toArray = sinon.stub().callsArgWith(0, null, @results)

			@before = 101

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
				@callback.calledWith(null, @updates_before).should.equal true

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
				@callback.calledWith(null, @updates_all).should.equal true

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

	describe "getDocChangesCount", ->
		beforeEach ->
			@db.docHistory =
				count: sinon.stub().callsArg(2)
			@MongoManager.getDocChangesCount @doc_id, @callback

		it "should return if there is any doc changes", ->
			@db.docHistory.count
				.calledWith({
					doc_id: ObjectId(@doc_id)
					inS3 : { $exists : false }
				}, {
				})
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "getArchivedDocChanges", ->
		beforeEach ->
			@db.docHistory =
				count: sinon.stub().callsArg(2)
			@MongoManager.getArchivedDocChanges @doc_id, @callback

		it "should return if there is any archived doc changes", ->
			@db.docHistory.count
				.calledWith({
					doc_id: ObjectId(@doc_id)
					inS3: {$exists: true}
				}, {
				})
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "markDocHistoryAsArchived", ->
		beforeEach ->
			@update = { _id: ObjectId(), op: "op", meta: "meta", v: "v"}
			@db.docHistory =
				update: sinon.stub().callsArg(2)
				remove: sinon.stub().callsArg(1)
			@MongoManager.markDocHistoryAsArchived @doc_id, @update, @callback

		it "should update last doc change with inS3 flag", ->
			@db.docHistory.update
				.calledWith({
					_id: ObjectId(@update._id)
				},{
					$set : { inS3 : true }
				})
				.should.equal true

		it "should remove any other doc changes before last update", ->
			@db.docHistory.remove
				.calledWith({
					doc_id: ObjectId(@doc_id)
					inS3 : { $exists : false }
					v: { $lt : @update.v }
					expiresAt: {$exists : false}
				})
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "markDocHistoryAsUnarchived", ->
		beforeEach ->
			@db.docHistory =
				update: sinon.stub().callsArg(3)
			@MongoManager.markDocHistoryAsUnarchived @doc_id, @callback

		it "should remove any doc changes inS3 flag", ->
			@db.docHistory.update
				.calledWith({
					doc_id: ObjectId(@doc_id)
				},{
					$unset : { inS3 : true }
				},{
					multi: true
				})
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true
