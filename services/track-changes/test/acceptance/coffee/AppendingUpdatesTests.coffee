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

describe "Appending doc ops to the history", ->
	describe "when the history does not exist yet", ->
		before (done) ->
			@project_id = ObjectId().toString()
			@doc_id = ObjectId().toString()
			@user_id = ObjectId().toString()
			TrackChangesClient.pushRawUpdates @doc_id, [{
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
				TrackChangesClient.flushAndGetCompressedUpdates @project_id, @doc_id, (error, @updates) =>
					throw error if error?
					done()

		it "should insert the compressed op into mongo", ->
			expect(@updates[0].op).to.deep.equal [{
				p: 3, i: "foo"
			}]

		it "should insert the correct version number into mongo", ->
			expect(@updates[0].v).to.equal 5

		it "should store the doc id", ->
			expect(@updates[0].doc_id.toString()).to.equal @doc_id

		it "should store the project id", ->
			expect(@updates[0].project_id.toString()).to.equal @project_id

	describe "when the history has already been started", ->
		beforeEach (done) ->
			@project_id = ObjectId().toString()
			@doc_id = ObjectId().toString()
			@user_id = ObjectId().toString()
			TrackChangesClient.pushRawUpdates @doc_id, [{
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
				TrackChangesClient.flushAndGetCompressedUpdates @project_id, @doc_id, (error, updates) =>
					throw error if error?
					done()

		describe "when the updates are recent and from the same user", ->
			beforeEach (done) ->
				TrackChangesClient.pushRawUpdates @doc_id, [{
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
					TrackChangesClient.flushAndGetCompressedUpdates @project_id, @doc_id, (error, @updates) =>
						throw error if error?
						done()

			it "should combine all the updates into one", ->
				expect(@updates[0].op).to.deep.equal [{
					p: 3, i: "foobar"
				}]

			it "should insert the correct version number into mongo", ->
				expect(@updates[0].v).to.equal 8


		describe "when the updates are far apart", ->
			beforeEach (done) ->
				oneDay = 24 * 60 * 60 * 1000
				TrackChangesClient.pushRawUpdates @doc_id, [{
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
					TrackChangesClient.flushAndGetCompressedUpdates @project_id, @doc_id, (error, @updates) =>
						throw error if error?
						done()

			it "should keep the updates separate", ->
				expect(@updates[0].op).to.deep.equal [{
					p: 3, i: "foo"
				}]
				expect(@updates[1].op).to.deep.equal [{
					p: 6, i: "bar"
				}]

	describe "when the updates need processing in batches", ->
		before (done) ->
			@project_id = ObjectId().toString()
			@doc_id = ObjectId().toString()
			@user_id = ObjectId().toString()
			updates = []
			@expectedOp = [{ p:0, i: "" }]
			for i in [0..250]
				updates.push {
					op: [{i: "a", p: 0}]
					meta: { ts: Date.now(), user_id: @user_id }
					v: i
				}
				@expectedOp[0].i = "a" + @expectedOp[0].i

			TrackChangesClient.pushRawUpdates @doc_id, updates, (error) =>
				throw error if error?
				TrackChangesClient.flushAndGetCompressedUpdates @project_id, @doc_id, (error, @updates) =>
					throw error if error?
					done()

		it "should concat the compressed op into mongo", ->
			expect(@updates[0].op).to.deep.equal @expectedOp

		it "should insert the correct version number into mongo", ->
			expect(@updates[0].v).to.equal 250


	describe "when there are multiple ops in each update", ->
		before (done) ->
			@project_id = ObjectId().toString()
			@doc_id = ObjectId().toString()
			@user_id = ObjectId().toString()
			oneDay = 24 * 60 * 60 * 1000
			TrackChangesClient.pushRawUpdates @doc_id, [{
				op: [{ i: "f", p: 3 }, { i: "o", p: 4 }, { i: "o", p: 5 }]
				meta: { ts: Date.now(), user_id: @user_id }
				v: 3
			}, {
				op: [{ i: "b", p: 6 }, { i: "a", p: 7 }, { i: "r", p: 8 }]
				meta: { ts: Date.now() + oneDay, user_id: @user_id }
				v: 4
			}], (error) =>
				throw error if error?
				TrackChangesClient.flushAndGetCompressedUpdates @project_id, @doc_id, (error, @updates) =>
					throw error if error?
					done()

		it "should insert the compressed ops into mongo", ->
			expect(@updates[0].op).to.deep.equal [{
				p: 3, i: "foo"
			}]
			expect(@updates[1].op).to.deep.equal [{
				p: 6, i: "bar"
			}]

		it "should insert the correct version numbers into mongo", ->
			expect(@updates[0].v).to.equal 3
			expect(@updates[1].v).to.equal 4

