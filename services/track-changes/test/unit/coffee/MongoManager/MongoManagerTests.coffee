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

		it "should sort in descending timestamp order", ->
			@db.docHistory.sort
				.calledWith("meta.end_ts": -1)
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
			@MongoManager.insertCompressedUpdate @doc_id, @update, @callback

		it "should insert the update", ->
			@db.docHistory.insert
				.calledWith({
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
			@MongoManager.insertCompressedUpdate = sinon.stub().callsArg(2)
			@MongoManager.insertCompressedUpdates @doc_id, @updates, (args...) =>
				@callback(args...)
				done()

		it "should insert each update", ->
			for update in @updates
				@MongoManager.insertCompressedUpdate
					.calledWith(@doc_id, update)
					.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "getUpdatesBetweenDates", ->
		beforeEach ->
			@updates = ["mock-update"]
			@db.docHistory = {}
			@db.docHistory.find = sinon.stub().returns @db.docHistory
			@db.docHistory.sort = sinon.stub().returns @db.docHistory
			@db.docHistory.toArray = sinon.stub().callsArgWith(0, null, @updates)

			@from = new Date(Date.now())
			@to = new Date(Date.now() + 100000)

		describe "with a toDate", ->
			beforeEach ->
				@MongoManager.getUpdatesBetweenDates @doc_id, from: @from, to: @to, @callback

			it "should find the all updates between the to and from date", ->
				@db.docHistory.find
					.calledWith({
						doc_id: ObjectId(@doc_id)
						"meta.end_ts": { $gte: @from }
						"meta.start_ts": { $lte: @to }
					})
					.should.equal true

			it "should sort in descending timestamp order", ->
				@db.docHistory.sort
					.calledWith("meta.end_ts": -1)
					.should.equal true

			it "should call the call back with the updates", ->
				@callback.calledWith(null, @updates).should.equal true

		describe "without a todo date", ->
			beforeEach ->
				@MongoManager.getUpdatesBetweenDates @doc_id, from: @from, @callback

			it "should find the all updates after the from date", ->
				@db.docHistory.find
					.calledWith({
						doc_id: ObjectId(@doc_id)
						"meta.end_ts": { $gte: @from }
					})
					.should.equal true

			it "should call the call back with the updates", ->
				@callback.calledWith(null, @updates).should.equal true

