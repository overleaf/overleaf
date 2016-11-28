sinon = require "sinon"
chai = require("chai")
chai.should()
async = require "async"
rclient = require("redis").createClient()

MockWebApi = require "./helpers/MockWebApi"
DocUpdaterClient = require "./helpers/DocUpdaterClient"

describe "Track changes", ->
	describe "turning on track changes", ->
		before (done) ->
			DocUpdaterClient.subscribeToAppliedOps @appliedOpsListener = sinon.stub()
			@project_id = DocUpdaterClient.randomId()
			@docs = [{
				id: doc_id0 = DocUpdaterClient.randomId()
				lines: ["one", "two", "three"]
				updatedLines: ["one", "one and a half", "two", "three"]
			}, {
				id: doc_id1 = DocUpdaterClient.randomId()
				lines: ["four", "five", "six"]
				updatedLines: ["four", "four and a half", "five", "six"]
			}]
			for doc in @docs
				MockWebApi.insertDoc @project_id, doc.id, {
					lines: doc.lines
					version: 0
				}
			async.series @docs.map((doc) =>
				(callback) =>
					DocUpdaterClient.preloadDoc @project_id, doc.id, callback
			), (error) =>
				throw error if error?
				setTimeout () =>
					DocUpdaterClient.setTrackChangesOn @project_id, (error, res, body) =>
						@statusCode = res.statusCode
						done()
				, 200

		it "should return a 204 status code", ->
			@statusCode.should.equal 204

		it "should send a track changes message to real-time for each doc", ->
			@appliedOpsListener.calledWith("applied-ops", JSON.stringify({
				project_id: @project_id, doc_id: @docs[0].id, track_changes_on: true
			})).should.equal true
			@appliedOpsListener.calledWith("applied-ops", JSON.stringify({
				project_id: @project_id, doc_id: @docs[1].id, track_changes_on: true
			})).should.equal true
		
		it "should set the track changes key in redis", (done) ->
			rclient.get "TrackChangesEnabled:#{@docs[0].id}", (error, value) =>
				throw error if error?
				value.should.equal "1"
				rclient.get "TrackChangesEnabled:#{@docs[1].id}", (error, value) ->
					throw error if error?
					value.should.equal "1"
					done()
	
	describe "tracking changes", ->
		before (done) ->
			@project_id = DocUpdaterClient.randomId()
			@doc = {
				id: doc_id0 = DocUpdaterClient.randomId()
				lines: ["one", "two", "three"]
			}
			@update =
				doc: @doc.id
				op: [{
					i: "one and a half\n"
					p: 4
				}]
				v: 0
				meta:
					user_id: @user_id = DocUpdaterClient.randomId()
			MockWebApi.insertDoc @project_id, @doc.id, {
				lines: @doc.lines
				version: 0
			}
			DocUpdaterClient.preloadDoc @project_id, @doc.id, (error) =>
				throw error if error?
				DocUpdaterClient.setTrackChangesOn @project_id, (error, res, body) =>
					throw error if error?
					DocUpdaterClient.sendUpdate @project_id, @doc.id, @update, (error) ->
						throw error if error?
						setTimeout done, 200
		
		it "should set the updated track changes entries in redis", (done) ->
			rclient.get "TrackChangesEntries:#{@doc.id}", (error, value) =>
				throw error if error?
				entries = JSON.parse(value)
				change = entries.changes[0]
				change.op.should.deep.equal @update.op[0]
				change.metadata.user_id.should.equal @user_id
				done()

