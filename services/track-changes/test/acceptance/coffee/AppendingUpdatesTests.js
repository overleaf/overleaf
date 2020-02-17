sinon = require "sinon"
chai = require("chai")
chai.should()
expect = chai.expect
mongojs = require "../../../app/js/mongojs"
ObjectId = mongojs.ObjectId
Settings = require "settings-sharelatex"
request = require "request"
rclient = require("redis").createClient(Settings.redis.history) # Only works locally for now

TrackChangesApp = require "./helpers/TrackChangesApp"
TrackChangesClient = require "./helpers/TrackChangesClient"
MockWebApi = require "./helpers/MockWebApi"

describe "Appending doc ops to the history", ->
	before (done)->
		TrackChangesApp.ensureRunning done

	describe "when the history does not exist yet", ->
		before (done) ->
			@project_id = ObjectId().toString()
			@doc_id = ObjectId().toString()
			@user_id = ObjectId().toString()
			MockWebApi.projects[@project_id] = features: versioning: false
			TrackChangesClient.pushRawUpdates @project_id, @doc_id, [{
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
			return null

		it "should insert the compressed op into mongo", ->
			expect(@updates[0].pack[0].op).to.deep.equal [{
				p: 3, i: "foo"
			}]

		it "should insert the correct version number into mongo", ->
			expect(@updates[0].v).to.equal 5

		it "should store the doc id", ->
			expect(@updates[0].doc_id.toString()).to.equal @doc_id

		it "should store the project id", ->
			expect(@updates[0].project_id.toString()).to.equal @project_id

		it "should clear the doc from the DocsWithHistoryOps set", (done) ->
			rclient.sismember "DocsWithHistoryOps:#{@project_id}", @doc_id, (error, member) ->
				member.should.equal 0
				done()
			return null

	describe "when the history has already been started", ->
		beforeEach (done) ->
			@project_id = ObjectId().toString()
			@doc_id = ObjectId().toString()
			@user_id = ObjectId().toString()
			MockWebApi.projects[@project_id] = features: versioning: false
			TrackChangesClient.pushRawUpdates @project_id, @doc_id, [{
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
			return null

		describe "when the updates are recent and from the same user", ->
			beforeEach (done) ->
				TrackChangesClient.pushRawUpdates @project_id, @doc_id, [{
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
				return null

			it "should combine all the updates into one pack", ->
				expect(@updates[0].pack[1].op).to.deep.equal [{
					p: 6, i: "bar"
				}]

			it "should insert the correct version number into mongo", ->
				expect(@updates[0].v_end).to.equal 8


		describe "when the updates are far apart", ->
			beforeEach (done) ->
				oneDay = 24 * 60 * 60 * 1000
				TrackChangesClient.pushRawUpdates @project_id, @doc_id, [{
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
				return null

			it "should combine the updates into one pack", ->
				expect(@updates[0].pack[0].op).to.deep.equal [{
					p: 3, i: "foo"
				}]
				expect(@updates[0].pack[1].op).to.deep.equal [{
					p: 6, i: "bar"
				}]

	describe "when the updates need processing in batches", ->
		before (done) ->
			@project_id = ObjectId().toString()
			@doc_id = ObjectId().toString()
			@user_id = ObjectId().toString()
			MockWebApi.projects[@project_id] = features: versioning: false
			updates = []
			@expectedOp = [{ p:0, i: "" }]
			for i in [0..250]
				updates.push {
					op: [{i: "a", p: 0}]
					meta: { ts: Date.now(), user_id: @user_id }
					v: i
				}
				@expectedOp[0].i = "a" + @expectedOp[0].i

			TrackChangesClient.pushRawUpdates @project_id, @doc_id, updates, (error) =>
				throw error if error?
				TrackChangesClient.flushAndGetCompressedUpdates @project_id, @doc_id, (error, @updates) =>
					throw error if error?
					done()
			return null

		it "should concat the compressed op into mongo", ->
			expect(@updates[0].pack.length).to.deep.equal 3  # batch size is 100

		it "should insert the correct version number into mongo", ->
			expect(@updates[0].v_end).to.equal 250


	describe "when there are multiple ops in each update", ->
		before (done) ->
			@project_id = ObjectId().toString()
			@doc_id = ObjectId().toString()
			@user_id = ObjectId().toString()
			MockWebApi.projects[@project_id] = features: versioning: false
			oneDay = 24 * 60 * 60 * 1000
			TrackChangesClient.pushRawUpdates @project_id, @doc_id, [{
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
			return null

		it "should insert the compressed ops into mongo", ->
			expect(@updates[0].pack[0].op).to.deep.equal [{
				p: 3, i: "foo"
			}]
			expect(@updates[0].pack[1].op).to.deep.equal [{
				p: 6, i: "bar"
			}]

		it "should insert the correct version numbers into mongo", ->
			expect(@updates[0].pack[0].v).to.equal 3
			expect(@updates[0].pack[1].v).to.equal 4

	describe "when there is a no-op update", ->
		before (done) ->
			@project_id = ObjectId().toString()
			@doc_id = ObjectId().toString()
			@user_id = ObjectId().toString()
			MockWebApi.projects[@project_id] = features: versioning: false
			oneDay = 24 * 60 * 60 * 1000
			TrackChangesClient.pushRawUpdates @project_id, @doc_id, [{
				op: []
				meta: { ts: Date.now(), user_id: @user_id }
				v: 3
			}, {
				op: [{ i: "foo", p: 3 }]
				meta: { ts: Date.now() + oneDay, user_id: @user_id }
				v: 4
			}], (error) =>
				throw error if error?
				TrackChangesClient.flushAndGetCompressedUpdates @project_id, @doc_id, (error, @updates) =>
					throw error if error?
					done()
			return null

		it "should insert the compressed no-op into mongo", ->
			expect(@updates[0].pack[0].op).to.deep.equal []


		it "should insert the compressed next update into mongo", ->
			expect(@updates[0].pack[1].op).to.deep.equal [{
				p: 3, i: "foo"
			}]

		it "should insert the correct version numbers into mongo", ->
			expect(@updates[0].pack[0].v).to.equal 3
			expect(@updates[0].pack[1].v).to.equal 4

	describe "when there is a comment update", ->
		before (done) ->
			@project_id = ObjectId().toString()
			@doc_id = ObjectId().toString()
			@user_id = ObjectId().toString()
			MockWebApi.projects[@project_id] = features: versioning: false
			TrackChangesClient.pushRawUpdates @project_id, @doc_id, [{
				op: [{ c: "foo", p: 3 }, {d: "bar", p: 6}]
				meta: { ts: Date.now(), user_id: @user_id }
				v: 3
			}], (error) =>
				throw error if error?
				TrackChangesClient.flushAndGetCompressedUpdates @project_id, @doc_id, (error, @updates) =>
					throw error if error?
					done()
			return null

		it "should ignore the comment op", ->
			expect(@updates[0].pack[0].op).to.deep.equal [{d: "bar", p: 6}]

		it "should insert the correct version numbers into mongo", ->
			expect(@updates[0].pack[0].v).to.equal 3

	describe "when the project has versioning enabled", ->
		before (done) ->
			@project_id = ObjectId().toString()
			@doc_id = ObjectId().toString()
			@user_id = ObjectId().toString()
			MockWebApi.projects[@project_id] = features: versioning: true

			TrackChangesClient.pushRawUpdates @project_id, @doc_id, [{
				op: [{ i: "f", p: 3 }]
				meta: { ts: Date.now(), user_id: @user_id }
				v: 3
			}], (error) =>
				throw error if error?
				TrackChangesClient.flushAndGetCompressedUpdates @project_id, @doc_id, (error, @updates) =>
					throw error if error?
					done()
			return null

		it "should not add a expiresAt entry in the update in mongo", ->
			expect(@updates[0].expiresAt).to.be.undefined

	describe "when the project does not have versioning enabled", ->
		before (done) ->
			@project_id = ObjectId().toString()
			@doc_id = ObjectId().toString()
			@user_id = ObjectId().toString()
			MockWebApi.projects[@project_id] = features: versioning: false

			TrackChangesClient.pushRawUpdates @project_id, @doc_id, [{
				op: [{ i: "f", p: 3 }]
				meta: { ts: Date.now(), user_id: @user_id }
				v: 3
			}], (error) =>
				throw error if error?
				TrackChangesClient.flushAndGetCompressedUpdates @project_id, @doc_id, (error, @updates) =>
					throw error if error?
					done()
			return null

		it "should add a expiresAt entry in the update in mongo", ->
			expect(@updates[0].expiresAt).to.exist
