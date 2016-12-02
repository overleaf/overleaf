sinon = require "sinon"
chai = require("chai")
chai.should()
async = require "async"
rclient = require("redis").createClient()

MockWebApi = require "./helpers/MockWebApi"
DocUpdaterClient = require "./helpers/DocUpdaterClient"

describe "Track changes", ->
	describe "tracking changes", ->
		before (done) ->
			@project_id = DocUpdaterClient.randomId()
			@user_id = DocUpdaterClient.randomId()
			@doc = {
				id: DocUpdaterClient.randomId()
				lines: ["aaa"]
			}
			@updates = [{
				doc: @doc.id
				op: [{ i: "123", p: 1 }]
				v: 0
				meta: { user_id: @user_id }
			}, {
				doc: @doc.id
				op: [{ i: "456", p: 5 }]
				v: 1
				meta: { user_id: @user_id, tc: 1 }
			}, {
				doc: @doc.id
				op: [{ d: "12", p: 1 }]
				v: 2
				meta: { user_id: @user_id }
			}]
			MockWebApi.insertDoc @project_id, @doc.id, {
				lines: @doc.lines
				version: 0
			}
			jobs = []
			for update in @updates
				do (update) =>
					jobs.push (callback) => DocUpdaterClient.sendUpdate @project_id, @doc.id, update, callback
			DocUpdaterClient.preloadDoc @project_id, @doc.id, (error) =>
				throw error if error?
				async.series jobs, (error) ->
					throw error if error?
					setTimeout done, 200
		
		it "should update the tracked entries", (done) ->
			DocUpdaterClient.getDoc @project_id, @doc.id, (error, res, data) =>
				throw error if error?
				entries = data.track_changes_entries
				change = entries.changes[0]
				change.op.should.deep.equal { i: "456", p: 3 }
				change.metadata.user_id.should.equal @user_id
				done()

	describe "Loading changes from persistence layer", ->
		before (done) ->
			@project_id = DocUpdaterClient.randomId()
			@user_id = DocUpdaterClient.randomId()
			@doc = {
				id: DocUpdaterClient.randomId()
				lines: ["a123aa"]
			}
			@update = {
				doc: @doc.id
				op: [{ i: "456", p: 5 }]
				v: 0
				meta: { user_id: @user_id, tc: 1 }
			}
			MockWebApi.insertDoc @project_id, @doc.id, {
				lines: @doc.lines
				version: 0
				track_changes_entries: {
					changes: [{
						op: { i: "123", p: 1 }
						metadata:
							user_id: @user_id
							ts: new Date()
					}]
				}
			}
			DocUpdaterClient.preloadDoc @project_id, @doc.id, (error) =>
				throw error if error?
				DocUpdaterClient.sendUpdate @project_id, @doc.id, @update, (error) ->
					throw error if error?
					setTimeout done, 200
		
		it "should have preloaded the existing changes", (done) ->
			DocUpdaterClient.getDoc @project_id, @doc.id, (error, res, data) =>
				throw error if error?
				{changes} = data.track_changes_entries
				changes[0].op.should.deep.equal { i: "123", p: 1 }
				changes[1].op.should.deep.equal { i: "456", p: 5 }
				done()
		
		it "should flush the changes to the persistence layer again", (done) ->
			DocUpdaterClient.flushDoc @project_id, @doc.id, (error) =>
				throw error if error?
				MockWebApi.getDocument @project_id, @doc.id, (error, doc) =>
					{changes} = doc.track_changes_entries
					changes[0].op.should.deep.equal { i: "123", p: 1 }
					changes[1].op.should.deep.equal { i: "456", p: 5 }
					done()
