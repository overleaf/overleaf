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
			"logger-sharelatex": { log: sinon.stub(), error: sinon.stub() }
		@callback = sinon.stub()
		@doc_id = ObjectId().toString()
		@project_id = ObjectId().toString()

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
						@db.docHistory.insert.calledWithMatch({
							pack: @newUpdates,
							project_id: ObjectId(@project_id),
							doc_id: ObjectId(@doc_id)
							n: @newUpdates.length
							v: @newUpdates[0].v
							v_end: @newUpdates[@newUpdates.length-1].v
						}).should.equal true

					it "should set an expiry time in the future", ->
						@db.docHistory.insert.calledWithMatch({
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
					@db.docHistory.insert.calledWithMatch({
						pack: @newUpdates,
						project_id: ObjectId(@project_id),
						doc_id: ObjectId(@doc_id)
						n: @newUpdates.length
						v: @newUpdates[0].v
						v_end: @newUpdates[@newUpdates.length-1].v
					}).should.equal true

				it "should set an expiry time in the future", ->
					@db.docHistory.insert.calledWithMatch({
						expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000)
					}).should.equal true

				it "should call the callback", ->
					@callback.called.should.equal true

	describe "convertDocsToPacks", ->
		describe "with several small ops", ->
			beforeEach ->
				@ops = [
					{ _id: "3", op: "op-3", meta: {start_ts: "ts3_s", end_ts: "ts3_e", user_id: "u3"}, v: 3},
					{ _id: "4", op: "op-4", meta: {start_ts: "ts4_s", end_ts: "ts4_e", user_id: "u4"}, v: 4},
				]
				@PackManager.convertDocsToPacks @ops, @callback

			it "should create a single pack", (done) ->
				@PackManager.convertDocsToPacks @ops, (err, packs) =>
					assert.deepEqual packs, [ {
						pack: [
							{ _id: "3", op: "op-3", meta: {start_ts: "ts3_s", end_ts: "ts3_e", user_id: "u3"}, v: 3},
							{ _id: "4", op: "op-4", meta: {start_ts: "ts4_s", end_ts: "ts4_e", user_id: "u4"}, v: 4},
						]
						v: 3
						v_end: 4
						meta: {start_ts: "ts3_s", end_ts: "ts4_e"}
						n: 2
						sz: 202
					}]
					done()

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "with many small ops", ->
			beforeEach ->
				@ops = ({ _id: "#{n}", op: "op-#{n}", meta: {start_ts: "ts#{n}_s", end_ts: "ts#{n}_e", user_id: "u#{n}"}, v: n} for n in [0...1024])
				@PackManager.convertDocsToPacks @ops, @callback

			it "should create two packs", (done) ->
				@PackManager.convertDocsToPacks @ops, (err, packs) =>
					assert.deepEqual packs, [ {
						pack: @ops[0...512]
						v: 0
						v_end: 511
						meta: {start_ts: "ts0_s", end_ts: "ts511_e"}
						n: 512
						sz: 56282
					}, {
						pack: @ops[512...1024]
						v: 512
						v_end: 1023
						meta: {start_ts: "ts512_s", end_ts: "ts1023_e"}
						n: 512
						sz: 56952
					}]
					done()

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "with many temporary ops", ->
			beforeEach ->
				@ops = ({ _id: "#{n}", op: "op-#{n}", meta: {start_ts: n, end_ts: n+1, user_id: "u#{n}"}, v: n, expiresAt: n+24*3600*1000 } for n in [0...1024])
				@PackManager.convertDocsToPacks @ops, @callback

			it "should create two packs", (done) ->
				@PackManager.convertDocsToPacks @ops, (err, packs) =>
					assert.deepEqual packs, [ {
						pack: (_.omit(op, "expiresAt") for op in @ops[0...512])
						v: 0
						v_end: 511
						meta: {start_ts: 0 , end_ts: 512}
						n: 512
						sz: 55990
						expiresAt: @ops[511].expiresAt
					}, {
						pack: (_.omit(op, "expiresAt") for op in @ops[512...1024])
						v: 512
						v_end: 1023
						meta: {start_ts: 512, end_ts: 1024}
						n: 512
						sz: 56392
						expiresAt: @ops[1023].expiresAt
					}]
					done()

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "with temporary ops spanning more than 1 day", ->
			beforeEach ->
				@ops = ({ _id: "#{n}", op: "op-#{n}", meta: {start_ts: n*3600*1000, end_ts: n*3600*1000+1, user_id: "u#{n}"}, v: n, expiresAt: n+24*3600*1000 } for n in [0...48])
				@PackManager.convertDocsToPacks @ops, @callback

			it "should create two packs", (done) ->
				@PackManager.convertDocsToPacks @ops, (err, packs) =>
					assert.deepEqual packs, [ {
						pack: (_.omit(op, "expiresAt") for op in @ops[0...24])
						v: 0
						v_end: 23
						meta: {start_ts: 0 , end_ts: 23*3600*1000+1}
						n: 24
						sz: 2538
						expiresAt: @ops[23].expiresAt
					}, {
						pack: (_.omit(op, "expiresAt") for op in @ops[24...48])
						v: 24
						v_end: 47
						meta: {start_ts: 24*3600*1000, end_ts: 47*3600*1000+1}
						n: 24
						sz: 2568
						expiresAt: @ops[47].expiresAt
					}]
					done()

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "with mixture of temporary and permanent ops", ->
			beforeEach ->
				@ops = ({ _id: "#{n}", op: "op-#{n}", meta: {start_ts: n*3600*1000, end_ts: n*3600*1000+1, user_id: "u#{n}"}, v: n, expiresAt: n+24*3600*1000 } for n in [0...48])
				for n in [10...48]
					delete @ops[n].expiresAt
				@PackManager.convertDocsToPacks @ops, @callback

			it "should create two packs", (done) ->
				@PackManager.convertDocsToPacks @ops, (err, packs) =>
					assert.deepEqual packs, [ {
						pack: (_.omit(op, "expiresAt") for op in @ops[0...10])
						v: 0
						v_end: 9
						meta: {start_ts: 0 , end_ts: 9*3600*1000+1}
						n: 10
						sz: 1040
						expiresAt: @ops[9].expiresAt
					}, {
						pack: (_.omit(op, "expiresAt") for op in @ops[10...48])
						v: 10
						v_end: 47
						meta: {start_ts: 10*3600*1000, end_ts: 47*3600*1000+1}
						n: 38
						sz: 3496
					}]
					done()

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "with mixture of temporary and permanent ops and an existing pack", ->
			beforeEach ->
				@ops = ({ _id: "#{n}", op: "op-#{n}", meta: {start_ts: n*3600*1000, end_ts: n*3600*1000+1, user_id: "u#{n}"}, v: n, expiresAt: n+24*3600*1000 } for n in [0...48])
				for n in [10...48]
					delete @ops[n].expiresAt
				# convert op 16 into a pack
				@ops[16].pack = [ @ops[16].op ]
				delete @ops[16].op
				@PackManager.convertDocsToPacks @ops, @callback

			it "should create three packs", (done) ->
				@PackManager.convertDocsToPacks @ops, (err, packs) =>
					assert.deepEqual packs, [ {
						pack: (_.omit(op, "expiresAt") for op in @ops[0...10])
						v: 0
						v_end: 9
						meta: {start_ts: 0 , end_ts: 9*3600*1000+1}
						n: 10
						sz: 1040
						expiresAt: @ops[9].expiresAt
					}, {
						pack: @ops[10...16]
						v: 10
						v_end: 15
						meta: {start_ts: 10*3600*1000, end_ts: 15*3600*1000+1}
						n: 6
						sz: 552
					}, {
						pack: @ops[17...48]
						v: 17
						v_end: 47
						meta: {start_ts: 17*3600*1000, end_ts: 47*3600*1000+1}
						n: 31
						sz: 2852
					}]
					done()

			it "should call the callback", ->
				@callback.called.should.equal true
