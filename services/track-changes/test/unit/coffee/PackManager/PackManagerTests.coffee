sinon = require('sinon')
chai = require('chai')
assert = require('chai').assert
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/PackManager.js"
SandboxedModule = require('sandboxed-module')
{ObjectId} = require("mongojs")
bson = require("bson")
BSON = new bson.BSONPure()
_ = require("underscore")

tk = require "timekeeper"

describe "PackManager", ->
	beforeEach ->
		tk.freeze(new Date())
		@PackManager = SandboxedModule.require modulePath, requires:
			"./mongojs" : { db: @db = {}, ObjectId: ObjectId, BSON: BSON }
			"./LockManager" : {}
			"./MongoAWS": {}
			"logger-sharelatex": { log: sinon.stub(), error: sinon.stub() }
		@callback = sinon.stub()
		@doc_id = ObjectId().toString()
		@project_id = ObjectId().toString()
		@PackManager.MAX_COUNT = 512


	afterEach ->
		tk.reset()

	describe "insertCompressedUpdates", ->
		beforeEach ->
			@lastUpdate = {
				_id: "12345"
				pack: [
					{ op: "op-1", meta: "meta-1", v: 1},
					{ op: "op-2", meta: "meta-2", v: 2}
				]
				n : 2
				sz : 100
			}
			@newUpdates = [
				{ op: "op-3", meta: "meta-3", v: 3},
				{ op: "op-4", meta: "meta-4", v: 4}
			]
			@db.docHistory =
				save: sinon.stub().callsArg(1)
				insert: sinon.stub().callsArg(1)
				findAndModify: sinon.stub().callsArg(1)

		describe "with no last update", ->
			beforeEach ->
				@PackManager.insertUpdatesIntoNewPack = sinon.stub().callsArg(4)
				@PackManager.insertCompressedUpdates @project_id, @doc_id, null, @newUpdates, true, @callback

			describe "for a small update", ->
				it "should insert the update into a new pack", ->
					@PackManager.insertUpdatesIntoNewPack.calledWith(@project_id, @doc_id, @newUpdates, true).should.equal true

				it "should call the callback", ->
					@callback.called.should.equal true

			describe "for many small updates", ->
				beforeEach ->
					@newUpdates = ({ op: "op-#{i}", meta: "meta-#{i}", v: i} for i in [0..2048])
					@PackManager.insertCompressedUpdates @project_id, @doc_id, null, @newUpdates, false, @callback

				it "should append the initial updates to the existing pack", ->
					@PackManager.insertUpdatesIntoNewPack.calledWith(@project_id, @doc_id, @newUpdates[0...512], false).should.equal true

				it "should insert the first set remaining updates as a new pack", ->
					@PackManager.insertUpdatesIntoNewPack.calledWith(@project_id, @doc_id, @newUpdates[512...1024], false).should.equal true

				it "should insert the second set of remaining updates as a new pack", ->
					@PackManager.insertUpdatesIntoNewPack.calledWith(@project_id, @doc_id, @newUpdates[1024...1536], false).should.equal true

				it "should insert the third set of remaining updates as a new pack", ->
					@PackManager.insertUpdatesIntoNewPack.calledWith(@project_id, @doc_id, @newUpdates[1536...2048], false).should.equal true

				it "should insert the final set of remaining updates as a new pack", ->
					@PackManager.insertUpdatesIntoNewPack.calledWith(@project_id, @doc_id, @newUpdates[2048..2048], false).should.equal true

				it "should call the callback", ->
					@callback.called.should.equal true



		describe "with an existing pack as the last update", ->
			beforeEach ->
				@PackManager.appendUpdatesToExistingPack = sinon.stub().callsArg(5)
				@PackManager.insertUpdatesIntoNewPack = sinon.stub().callsArg(4)
				@PackManager.insertCompressedUpdates @project_id, @doc_id, @lastUpdate, @newUpdates, false, @callback

			describe "for a small update", ->
				it "should append the update to the existing pack", ->
					@PackManager.appendUpdatesToExistingPack.calledWith(@project_id, @doc_id, @lastUpdate, @newUpdates, false).should.equal true
				it "should not insert any new packs", ->
					@PackManager.insertUpdatesIntoNewPack.called.should.equal false
				it "should call the callback", ->
					@callback.called.should.equal true

			describe "for many small updates", ->
				beforeEach ->
					@newUpdates = ({ op: "op-#{i}", meta: "meta-#{i}", v: i} for i in [0..2048])
					@PackManager.insertCompressedUpdates @project_id, @doc_id, @lastUpdate, @newUpdates, false, @callback

				it "should append the initial updates to the existing pack", ->
					@PackManager.appendUpdatesToExistingPack.calledWith(@project_id, @doc_id, @lastUpdate, @newUpdates[0...510], false).should.equal true

				it "should insert the first set remaining updates as a new pack", ->
					@PackManager.insertUpdatesIntoNewPack.calledWith(@project_id, @doc_id, @newUpdates[510...1022], false).should.equal true

				it "should insert the second set of remaining updates as a new pack", ->
					@PackManager.insertUpdatesIntoNewPack.calledWith(@project_id, @doc_id, @newUpdates[1022...1534], false).should.equal true

				it "should insert the third set of remaining updates as a new pack", ->
					@PackManager.insertUpdatesIntoNewPack.calledWith(@project_id, @doc_id, @newUpdates[1534...2046], false).should.equal true

				it "should insert the final set of remaining updates as a new pack", ->
					@PackManager.insertUpdatesIntoNewPack.calledWith(@project_id, @doc_id, @newUpdates[2046..2048], false).should.equal true

				it "should call the callback", ->
					@callback.called.should.equal true

			describe "for many big updates", ->
				beforeEach ->
					longString = ("a" for [0 .. (0.75*@PackManager.MAX_SIZE)]).join("")
					@newUpdates = ({ op: "op-#{i}-#{longString}", meta: "meta-#{i}", v: i} for i in [0..4])
					@PackManager.insertCompressedUpdates @project_id, @doc_id, @lastUpdate, @newUpdates, false, @callback

				it "should append the initial updates to the existing pack", ->
					@PackManager.appendUpdatesToExistingPack.calledWith(@project_id, @doc_id, @lastUpdate, @newUpdates[0..0], false).should.equal true

				it "should insert the first set remaining updates as a new pack", ->
					@PackManager.insertUpdatesIntoNewPack.calledWith(@project_id, @doc_id, @newUpdates[1..1], false).should.equal true

				it "should insert the second set of remaining updates as a new pack", ->
					@PackManager.insertUpdatesIntoNewPack.calledWith(@project_id, @doc_id, @newUpdates[2..2], false).should.equal true

				it "should insert the third set of remaining updates as a new pack", ->
					@PackManager.insertUpdatesIntoNewPack.calledWith(@project_id, @doc_id, @newUpdates[3..3], false).should.equal true

				it "should insert the final set of remaining updates as a new pack", ->
					@PackManager.insertUpdatesIntoNewPack.calledWith(@project_id, @doc_id, @newUpdates[4..4], false).should.equal true

				it "should call the callback", ->
					@callback.called.should.equal true

		describe "flushCompressedUpdates", ->
			describe "when there is no previous update",  ->
				beforeEach ->
					@PackManager.flushCompressedUpdates @project_id, @doc_id, null, @newUpdates, true, @callback

				describe "for a small update  that will expire", ->
					it "should insert the update into mongo", ->
						@db.docHistory.save.calledWithMatch({
							pack: @newUpdates,
							project_id: ObjectId(@project_id),
							doc_id: ObjectId(@doc_id)
							n: @newUpdates.length
							v: @newUpdates[0].v
							v_end: @newUpdates[@newUpdates.length-1].v
						}).should.equal true

					it "should set an expiry time in the future", ->
						@db.docHistory.save.calledWithMatch({
							expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000)
						}).should.equal true

					it "should call the callback", ->
						@callback.called.should.equal true

		describe "when there is a recent previous update in mongo", ->
			beforeEach ->
				@lastUpdate = {
					_id: "12345"
					pack: [
						{ op: "op-1", meta: "meta-1", v: 1},
						{ op: "op-2", meta: "meta-2", v: 2}
					]
					n : 2
					sz : 100
					expiresAt: new Date(Date.now())
				}

				@PackManager.flushCompressedUpdates @project_id, @doc_id, @lastUpdate, @newUpdates, true, @callback

			describe "for a small update that will expire", ->
				it "should append the update in mongo", ->
					@db.docHistory.findAndModify.calledWithMatch({
						query: {_id: @lastUpdate._id}
						update: { $push: {"pack" : {$each: @newUpdates}}, $set: {v_end: @newUpdates[@newUpdates.length-1].v}}
					}).should.equal true

				it "should set an expiry time in the future", ->
					@db.docHistory.findAndModify.calledWithMatch({
						update: {$set: {expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000)}}
					}).should.equal true

				it "should call the callback", ->
					@callback.called.should.equal true


		describe "when there is an old previous update in mongo", ->
			beforeEach ->
				@lastUpdate = {
					_id: "12345"
					pack: [
						{ op: "op-1", meta: "meta-1", v: 1},
						{ op: "op-2", meta: "meta-2", v: 2}
					]
					n : 2
					sz : 100
					meta: {start_ts: Date.now() - 30 * 24 * 3600 * 1000}
					expiresAt: new Date(Date.now() - 30 * 24 * 3600 * 1000)
				}

				@PackManager.flushCompressedUpdates @project_id, @doc_id, @lastUpdate, @newUpdates, true, @callback

			describe "for a small update that will expire", ->
				it "should insert the update into mongo", ->
					@db.docHistory.save.calledWithMatch({
						pack: @newUpdates,
						project_id: ObjectId(@project_id),
						doc_id: ObjectId(@doc_id)
						n: @newUpdates.length
						v: @newUpdates[0].v
						v_end: @newUpdates[@newUpdates.length-1].v
					}).should.equal true

				it "should set an expiry time in the future", ->
					@db.docHistory.save.calledWithMatch({
						expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000)
					}).should.equal true

				it "should call the callback", ->
					@callback.called.should.equal true


	describe "getOpsByVersionRange", ->

	describe "loadPacksByVersionRange", ->

	describe "fetchPacksIfNeeded", ->

	describe "makeProjectIterator", ->

	describe "getPackById", ->

	describe "increaseTTL", ->

	describe "getIndex", ->

	describe "getPackFromIndex", ->
# getLastPackFromIndex:
# getIndexWithKeys
# initialiseIndex
# updateIndex
# findCompletedPacks
# findUnindexedPacks
# insertPacksIntoIndexWithLock
# _insertPacksIntoIndex
# archivePack
# checkArchivedPack
# processOldPack
# 	updateIndexIfNeeded
# 	findUnarchivedPacks

	describe "checkArchiveNotInProgress", ->

		describe "when an archive is in progress", ->
			beforeEach ->
				@db.docHistoryIndex =
					findOne: sinon.stub().callsArgWith(2, null, {inS3:false})
				@PackManager.checkArchiveNotInProgress @project_id, @doc_id, @pack_id, @callback
			it "should call the callback", ->
				@callback.called.should.equal true
			it "should return an error", ->
				@callback.calledWith(new Error()).should.equal true

		describe "when an archive is completed", ->
			beforeEach ->
				@db.docHistoryIndex =
					findOne: sinon.stub().callsArgWith(2, null, {inS3:true})
				@PackManager.checkArchiveNotInProgress @project_id, @doc_id, @pack_id, @callback
			it "should call the callback", ->
				@callback.called.should.equal true
			it "should return an error", ->
				@callback.calledWith(new Error()).should.equal true

		describe "when the archive has not started or completed", ->
			beforeEach ->
				@db.docHistoryIndex =
					findOne: sinon.stub().callsArgWith(2, null, {})
				@PackManager.checkArchiveNotInProgress @project_id, @doc_id, @pack_id, @callback
			it "should call the callback", ->
				@callback.called.should.equal true
			it "should return with no error", ->
				@callback.calledWith(undefined).should.equal true
