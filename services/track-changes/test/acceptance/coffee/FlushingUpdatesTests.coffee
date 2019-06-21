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

describe "Flushing updates", ->
	before (done)->
		TrackChangesApp.ensureRunning done

	describe "flushing a doc's updates", ->
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
				TrackChangesClient.flushDoc @project_id, @doc_id, (error) ->
					throw error if error?
					done()
			return null

		it "should flush the op into mongo", (done) ->
			TrackChangesClient.getCompressedUpdates @doc_id, (error, updates) ->
				expect(updates[0].pack[0].op).to.deep.equal [{
					p: 3, i: "f"
				}]
				done()
			return null

	describe "flushing a project's updates", ->
		describe "with versioning enabled", ->
			before (done) ->
				@project_id = ObjectId().toString()
				@doc_id = ObjectId().toString()
				@user_id = ObjectId().toString()

				@weeks = 7 * 24 * 60 * 60 * 1000

				MockWebApi.projects[@project_id] =
					features:
						versioning: true

				TrackChangesClient.pushRawUpdates @project_id, @doc_id, [{
					op: [{ i: "g", p: 2 }]
					meta: { ts: Date.now() - 2 * @weeks, user_id: @user_id }
					v: 2
				}, {
					op: [{ i: "f", p: 3 }]
					meta: { ts: Date.now(), user_id: @user_id }
					v: 3
				}], (error) =>
					throw error if error?
					TrackChangesClient.flushProject @project_id, (error) ->
						throw error if error?
						done()
				return null

			it "should not mark the updates for deletion", (done) ->
				TrackChangesClient.getCompressedUpdates @doc_id, (error, updates) ->
					expect(updates[0].expiresAt).to.not.exist
					done()
				return null

			it "should preserve history forever", (done) ->
				TrackChangesClient.getProjectMetaData @project_id, (error, project) ->
					expect(project.preserveHistory).to.equal true
					done()
				return null

		describe "without versioning enabled", ->
			before (done) ->
				@project_id = ObjectId().toString()
				@doc_id = ObjectId().toString()
				@user_id = ObjectId().toString()

				@weeks = 7 * 24 * 60 * 60 * 1000

				MockWebApi.projects[@project_id] =
					features:
						versioning: false

				TrackChangesClient.pushRawUpdates @project_id, @doc_id, [{
					op: [{ i: "g", p: 2 }]
					meta: { ts: Date.now() - 2 * @weeks, user_id: @user_id }
					v: 2
				}, {
					op: [{ i: "f", p: 3 }]
					meta: { ts: Date.now(), user_id: @user_id }
					v: 3
				}], (error) =>
					throw error if error?
					TrackChangesClient.flushProject @project_id, (error) ->
						throw error if error?
						done()
				return null

			it "should mark the updates for deletion", (done) ->
				TrackChangesClient.getCompressedUpdates @doc_id, (error, updates) ->
					expect(updates[0].expiresAt).to.exist
					done()
				return null

		describe "without versioning enabled but with preserveHistory set to true", ->
			before (done) ->
				@project_id = ObjectId().toString()
				@doc_id = ObjectId().toString()
				@user_id = ObjectId().toString()

				@weeks = 7 * 24 * 60 * 60 * 1000

				MockWebApi.projects[@project_id] =
					features:
						versioning: false

				TrackChangesClient.setPreserveHistoryForProject @project_id, (error) =>
					throw error if error?
					TrackChangesClient.pushRawUpdates @project_id, @doc_id, [{
						op: [{ i: "g", p: 2 }]
						meta: { ts: Date.now() - 2 * @weeks, user_id: @user_id }
						v: 2
					}, {
						op: [{ i: "f", p: 3 }]
						meta: { ts: Date.now(), user_id: @user_id }
						v: 3
					}], (error) =>
						throw error if error?
						TrackChangesClient.flushProject @project_id, (error) ->
							throw error if error?
							done()
				return null

			it "should not mark the updates for deletion", (done) ->
				TrackChangesClient.getCompressedUpdates @doc_id, (error, updates) ->
					expect(updates[0].expiresAt).to.not.exist
					done()
				return null
