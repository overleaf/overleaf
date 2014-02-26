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

flushAndGetCompressedUpdates = (doc_id, callback = (error, updates) ->) ->
	request.post {
		url: "http://localhost:#{Settings.port}/doc/#{doc_id}/flush"
	}, (error, response, body) =>
		response.statusCode.should.equal 204
		db.docHistory
			.find(doc_id: ObjectId(doc_id))
			.sort("meta.end_ts": 1)
			.toArray callback

pushRawUpdates = (doc_id, updates, callback = (error) ->) ->
	rclient.rpush "UncompressedHistoryOps:#{doc_id}", (JSON.stringify(u) for u in updates)..., callback

describe "Appending doc ops to the history", ->
	describe "when the history does not exist yet", ->
		before (done) ->
			@doc_id = ObjectId().toString()
			@user_id = ObjectId().toString()
			pushRawUpdates @doc_id, [{
				op: [{ i: "f", p: 3 }]
				meta: { ts: Date.now(), user_id: @user_id }
				v: 3
			}, {
				op: [{ i: "o", p: 4 }]
				meta: { ts: Date.now(), user_id: @user_id }
				v: 4
			}, {
				op: [{ i: "o", p: 5 }]
				meta: { ts: Date.now(), user_id: @user_id }
				v: 5
			}], (error) =>
				throw error if error?
				flushAndGetCompressedUpdates @doc_id, (error, @updates) =>
					throw error if error?
					done()

		it "should insert the compressed op into mongo", ->
			expect(@updates[0].op).to.deep.equal {
				p: 3, i: "foo"
			}

		it "should insert the correct version number into mongo", ->
			expect(@updates[0].v).to.equal 5

	describe "when the history has already been started", ->
		beforeEach (done) ->
			@doc_id = ObjectId().toString()
			@user_id = ObjectId().toString()
			pushRawUpdates @doc_id, [{
				op: [{ i: "f", p: 3 }]
				meta: { ts: Date.now(), user_id: @user_id }
				v: 3
			}, {
				op: [{ i: "o", p: 4 }]
				meta: { ts: Date.now(), user_id: @user_id }
				v: 4
			}, {
				op: [{ i: "o", p: 5 }]
				meta: { ts: Date.now(), user_id: @user_id }
				v: 5
			}], (error) =>
				throw error if error?
				flushAndGetCompressedUpdates @doc_id, (error, updates) =>
					throw error if error?
					done()

		describe "when the updates are recent and from the same user", ->
			beforeEach (done) ->
				pushRawUpdates @doc_id, [{
					op: [{ i: "b", p: 6 }]
					meta: { ts: Date.now(), user_id: @user_id }
					v: 6
				}, {
					op: [{ i: "a", p: 7 }]
					meta: { ts: Date.now(), user_id: @user_id }
					v: 7
				}, {
					op: [{ i: "r", p: 8 }]
					meta: { ts: Date.now(), user_id: @user_id }
					v: 8
				}], (error) =>
					throw error if error?
					flushAndGetCompressedUpdates @doc_id, (error, @updates) =>
						throw error if error?
						done()

			it "should combine all the updates into one", ->
				expect(@updates[0].op).to.deep.equal {
					p: 3, i: "foobar"
				}

			it "should insert the correct version number into mongo", ->
				expect(@updates[0].v).to.equal 8


		describe "when the updates are far apart", ->
			beforeEach (done) ->
				oneDay = 24 * 60 * 60 * 1000
				pushRawUpdates @doc_id, [{
					op: [{ i: "b", p: 6 }]
					meta: { ts: Date.now() + oneDay, user_id: @user_id }
					v: 6
				}, {
					op: [{ i: "a", p: 7 }]
					meta: { ts: Date.now() + oneDay, user_id: @user_id }
					v: 7
				}, {
					op: [{ i: "r", p: 8 }]
					meta: { ts: Date.now() + oneDay, user_id: @user_id }
					v: 8
				}], (error) =>
					throw error if error?
					flushAndGetCompressedUpdates @doc_id, (error, @updates) =>
						throw error if error?
						done()

			it "should keep the updates separate", ->
				expect(@updates[0].op).to.deep.equal {
					p: 3, i: "foo"
				}
				expect(@updates[1].op).to.deep.equal {
					p: 6, i: "bar"
				}

	describe "when the updates need processing in batches", ->
		before (done) ->
			@doc_id = ObjectId().toString()
			@user_id = ObjectId().toString()
			updates = []
			@expectedOp = { p:0, i: "" }
			for i in [0..250]
				updates.push {
					op: [{i: "a", p: 0}]
					meta: { ts: Date.now(), user_id: @user_id }
					v: i
				}
				@expectedOp.i = "a" + @expectedOp.i

			pushRawUpdates @doc_id, updates, (error) =>
				throw error if error?
				flushAndGetCompressedUpdates @doc_id, (error, @updates) =>
					throw error if error?
					done()

		it "should concat the compressed op into mongo", ->
			expect(@updates[0].op).to.deep.equal @expectedOp

		it "should insert the correct version number into mongo", ->
			expect(@updates[0].v).to.equal 250

