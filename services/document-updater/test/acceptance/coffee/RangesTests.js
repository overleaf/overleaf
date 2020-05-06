sinon = require "sinon"
chai = require("chai")
chai.should()
expect = chai.expect
async = require "async"

{db, ObjectId} = require "../../../app/js/mongojs"
MockWebApi = require "./helpers/MockWebApi"
DocUpdaterClient = require "./helpers/DocUpdaterClient"
DocUpdaterApp = require "./helpers/DocUpdaterApp"

describe "Ranges", ->
	before (done) ->
		DocUpdaterApp.ensureRunning done

	describe "tracking changes from ops", ->
		before (done) ->
			@project_id = DocUpdaterClient.randomId()
			@user_id = DocUpdaterClient.randomId()
			@id_seed = "587357bd35e64f6157"
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
				meta: { user_id: @user_id, tc: @id_seed }
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
			
			DocUpdaterApp.ensureRunning (error) =>
				throw error if error?
				DocUpdaterClient.preloadDoc @project_id, @doc.id, (error) =>
					throw error if error?
					async.series jobs, (error) ->
						throw error if error?
						done()
		
		it "should update the ranges", (done) ->
			DocUpdaterClient.getDoc @project_id, @doc.id, (error, res, data) =>
				throw error if error?
				ranges = data.ranges
				change = ranges.changes[0]
				change.op.should.deep.equal { i: "456", p: 3 }
				change.id.should.equal @id_seed + "000001"
				change.metadata.user_id.should.equal @user_id
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
						comment.id.should.equal @tid
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
			@id_seed = "587357bd35e64f6157"
			@doc = {
				id: DocUpdaterClient.randomId()
				lines: ["a123aa"]
			}
			@update = {
				doc: @doc.id
				op: [{ i: "456", p: 5 }]
				v: 0
				meta: { user_id: @user_id, tc: @id_seed }
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

	describe "accepting a change", ->
		before (done) ->
			@project_id = DocUpdaterClient.randomId()
			@user_id = DocUpdaterClient.randomId()
			@id_seed = "587357bd35e64f6157"
			@doc = {
				id: DocUpdaterClient.randomId()
				lines: ["aaa"]
			}
			@update = {
				doc: @doc.id
				op: [{ i: "456", p: 1 }]
				v: 0
				meta: { user_id: @user_id, tc: @id_seed }
			}
			MockWebApi.insertDoc @project_id, @doc.id, {
				lines: @doc.lines
				version: 0
			}
			DocUpdaterClient.preloadDoc @project_id, @doc.id, (error) =>
				throw error if error?
				DocUpdaterClient.sendUpdate @project_id, @doc.id, @update, (error) =>
					throw error if error?
					setTimeout () =>
						DocUpdaterClient.getDoc @project_id, @doc.id, (error, res, data) =>
							throw error if error?
							ranges = data.ranges
							change = ranges.changes[0]
							change.op.should.deep.equal { i: "456", p: 1 }
							change.id.should.equal @id_seed + "000001"
							change.metadata.user_id.should.equal @user_id
							done()
					, 200
		
		it "should remove the change after accepting", (done) ->
			DocUpdaterClient.acceptChange @project_id, @doc.id, @id_seed + "000001", (error) =>
				throw error if error?
				DocUpdaterClient.getDoc @project_id, @doc.id, (error, res, data) =>
					throw error if error?
					expect(data.ranges.changes).to.be.undefined
					done()

	describe "deleting a comment range", ->
		before (done) ->
			@project_id = DocUpdaterClient.randomId()
			@user_id = DocUpdaterClient.randomId()
			@doc = {
				id: DocUpdaterClient.randomId()
				lines: ["foo bar"]
			}
			@update = {
				doc: @doc.id
				op: [{ c: "bar", p: 4, t: @tid = DocUpdaterClient.randomId() }]
				v: 0
			}
			MockWebApi.insertDoc @project_id, @doc.id, {
				lines: @doc.lines
				version: 0
			}
			DocUpdaterClient.preloadDoc @project_id, @doc.id, (error) =>
				throw error if error?
				DocUpdaterClient.sendUpdate @project_id, @doc.id, @update, (error) =>
					throw error if error?
					setTimeout () =>
						DocUpdaterClient.getDoc @project_id, @doc.id, (error, res, data) =>
							throw error if error?
							ranges = data.ranges
							change = ranges.comments[0]
							change.op.should.deep.equal { c: "bar", p: 4, t: @tid }
							change.id.should.equal @tid
							done()
					, 200
		
		it "should remove the comment range", (done) ->
			DocUpdaterClient.removeComment @project_id, @doc.id, @tid, (error, res) =>
				throw error if error?
				expect(res.statusCode).to.equal 204
				DocUpdaterClient.getDoc @project_id, @doc.id, (error, res, data) =>
					throw error if error?
					expect(data.ranges.comments).to.be.undefined
					done()
					
	describe "tripping range size limit", ->
		before (done) ->
			@project_id = DocUpdaterClient.randomId()
			@user_id = DocUpdaterClient.randomId()
			@id_seed = DocUpdaterClient.randomId()
			@doc = {
				id: DocUpdaterClient.randomId()
				lines: ["aaa"]
			}
			@i = new Array(3 * 1024 * 1024).join("a")
			@updates = [{
				doc: @doc.id
				op: [{ i: @i, p: 1 }]
				v: 0
				meta: { user_id: @user_id, tc: @id_seed }
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
		
		it "should not update the ranges", (done) ->
			DocUpdaterClient.getDoc @project_id, @doc.id, (error, res, data) =>
				throw error if error?
				ranges = data.ranges
				expect(ranges.changes).to.be.undefined
				done()

	describe "deleting text surrounding a comment", ->
		before (done) ->
			@project_id = DocUpdaterClient.randomId()
			@user_id = DocUpdaterClient.randomId()
			@doc_id = DocUpdaterClient.randomId()
			MockWebApi.insertDoc @project_id, @doc_id, {
				lines: ["foo bar baz"]
				version: 0
				ranges: {
					comments: [{
						op: { c: "a", p: 5, tid: @tid = DocUpdaterClient.randomId() }
						metadata:
							user_id: @user_id
							ts: new Date()
					}]
				}
			}
			@updates = [{
				doc: @doc_id
				op: [{ d: "foo ", p: 0 }]
				v: 0
				meta: { user_id: @user_id }
			}, {
				doc: @doc_id
				op: [{ d: "bar ", p: 0 }]
				v: 1
				meta: { user_id: @user_id }
			}]
			jobs = []
			for update in @updates
				do (update) =>
					jobs.push (callback) => DocUpdaterClient.sendUpdate @project_id, @doc_id, update, callback
			DocUpdaterClient.preloadDoc @project_id, @doc_id, (error) =>
				throw error if error?
				async.series jobs, (error) ->
					throw error if error?
					setTimeout () =>
						DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, data) =>
							throw error if error?
							done()
					, 200
		
		it "should write a snapshot from before the destructive change", (done) ->
			DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, data) =>
				return done(error) if error?
				db.docSnapshots.find {
					project_id: ObjectId(@project_id),
					doc_id: ObjectId(@doc_id)
				}, (error, docSnapshots) =>
					return done(error) if error?
					expect(docSnapshots.length).to.equal 1
					expect(docSnapshots[0].version).to.equal 1
					expect(docSnapshots[0].lines).to.deep.equal ["bar baz"]
					expect(docSnapshots[0].ranges.comments[0].op).to.deep.equal {
						c: "a",
						p: 1,
						tid: @tid
					}
					done()
