sinon = require "sinon"
chai = require("chai")
chai.should()
expect = chai.expect
async = require "async"
rclient = require("redis").createClient()

MockWebApi = require "./helpers/MockWebApi"
DocUpdaterClient = require "./helpers/DocUpdaterClient"

describe "Ranges", ->
	describe "tracking changes from ops", ->
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
		
		it "should update the ranges", (done) ->
			DocUpdaterClient.getDoc @project_id, @doc.id, (error, res, data) =>
				throw error if error?
				ranges = data.ranges
				change = ranges.changes[0]
				change.op.should.deep.equal { i: "456", p: 3 }
				change.metadata.user_id.should.equal @user_id
				done()
		
		describe "removing ranges", ->
			it "should delete the range (and perform OT)", (done) ->
				@conflicting_update = {
					doc: @doc.id
					op: [{ i: "X", p: 1 }]
					v: 3
					meta: { user_id: @user_id }
				}
				@delete_range = {
					doc: @doc.id
					op: [{ dr: "456", p: 3 }]
					v: 3
					meta: { user_id: @user_id }
				}
				DocUpdaterClient.sendUpdate @project_id, @doc.id, @conflicting_update, (error) =>
					throw error if error?
					DocUpdaterClient.sendUpdate @project_id, @doc.id, @delete_range, (error) =>
						throw error if error?
						DocUpdaterClient.getDoc @project_id, @doc.id, (error, res, data) =>
							throw error if error?
							expect(data.ranges.changes).to.be.undefined
							done()
	
	describe "Adding comments", ->
		describe "standalone", ->
			before (done) ->
				@project_id = DocUpdaterClient.randomId()
				@user_id = DocUpdaterClient.randomId()
				@doc = {
					id: DocUpdaterClient.randomId()
					lines: ["foo bar baz"]
				}
				@updates = [{
					doc: @doc.id
					op: [{ c: "bar", p: 4, t: @tid = DocUpdaterClient.randomId() }]
					v: 0
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
			
			it "should update the ranges", (done) ->
				DocUpdaterClient.getDoc @project_id, @doc.id, (error, res, data) =>
					throw error if error?
					ranges = data.ranges
					comment = ranges.comments[0]
					comment.op.should.deep.equal { c: "bar", p: 4, t: @tid }
					done()

		describe "with conflicting ops needing OT", ->
			before (done) ->
				@project_id = DocUpdaterClient.randomId()
				@user_id = DocUpdaterClient.randomId()
				@doc = {
					id: DocUpdaterClient.randomId()
					lines: ["foo bar baz"]
				}
				@updates = [{
					doc: @doc.id
					op: [{ i: "ABC", p: 3 }]
					v: 0
					meta: { user_id: @user_id }
				}, {
					doc: @doc.id
					op: [{ c: "bar", p: 4, t: @tid = DocUpdaterClient.randomId() }]
					v: 0
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
			
			it "should update the comments with the OT shifted comment", (done) ->
				DocUpdaterClient.getDoc @project_id, @doc.id, (error, res, data) =>
					throw error if error?
					ranges = data.ranges
					comment = ranges.comments[0]
					comment.op.should.deep.equal { c: "bar", p: 7, t: @tid }
					done()

	describe "Loading ranges from persistence layer", ->
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
				ranges: {
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
		
		it "should have preloaded the existing ranges", (done) ->
			DocUpdaterClient.getDoc @project_id, @doc.id, (error, res, data) =>
				throw error if error?
				{changes} = data.ranges
				changes[0].op.should.deep.equal { i: "123", p: 1 }
				changes[1].op.should.deep.equal { i: "456", p: 5 }
				done()
		
		it "should flush the ranges to the persistence layer again", (done) ->
			DocUpdaterClient.flushDoc @project_id, @doc.id, (error) =>
				throw error if error?
				MockWebApi.getDocument @project_id, @doc.id, (error, doc) =>
					{changes} = doc.ranges
					changes[0].op.should.deep.equal { i: "123", p: 1 }
					changes[1].op.should.deep.equal { i: "456", p: 5 }
					done()
