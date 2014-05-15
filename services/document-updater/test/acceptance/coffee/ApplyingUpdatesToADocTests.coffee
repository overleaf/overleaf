sinon = require "sinon"
chai = require("chai")
chai.should()
async = require "async"
rclient = require("redis").createClient()
{db, ObjectId} = require "../../../app/js/mongojs"

MockTrackChangesApi = require "./helpers/MockTrackChangesApi"
MockWebApi = require "./helpers/MockWebApi"
DocUpdaterClient = require "./helpers/DocUpdaterClient"

describe "Applying updates to a doc", ->
	before ->
		@lines = ["one", "two", "three"]
		@version = 42
		@update =
			doc: @doc_id
			op: [{
				i: "one and a half\n"
				p: 4
			}]
			v: @version
		@result = ["one", "one and a half", "two", "three"]

	describe "when the document is not loaded", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			sinon.spy MockWebApi, "getDocument"

			MockWebApi.insertDoc @project_id, @doc_id, lines: @lines
			db.docOps.insert {
				doc_id: ObjectId(@doc_id)
				version: @version
			}, (error) =>
				throw error if error?
				DocUpdaterClient.sendUpdate @project_id, @doc_id, @update, (error) ->
					throw error if error?
					setTimeout done, 200

		after ->
			MockWebApi.getDocument.restore()

		it "should load the document from the web API", ->
			MockWebApi.getDocument
				.calledWith(@project_id, @doc_id)
				.should.equal true

		it "should update the doc", (done) ->
			DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				doc.lines.should.deep.equal @result
				done()

		it "should push the applied updates to the track changes api", (done) ->
			rclient.lrange "UncompressedHistoryOps:#{@doc_id}", 0, -1, (error, updates) =>
				throw error if error?
				JSON.parse(updates[0]).op.should.deep.equal @update.op
				rclient.sismember "DocsWithHistoryOps:#{@project_id}", @doc_id, (error, result) =>
					throw error if error?
					result.should.equal 1
					done()


	describe "when the document is loaded", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]

			MockWebApi.insertDoc @project_id, @doc_id, lines: @lines
			db.docOps.insert doc_id: ObjectId(@doc_id), version: @version, (error) =>
				throw error if error?
				DocUpdaterClient.preloadDoc @project_id, @doc_id, (error) =>
					throw error if error?
					sinon.spy MockWebApi, "getDocument"
					DocUpdaterClient.sendUpdate @project_id, @doc_id, @update, (error) ->
						throw error if error?
						setTimeout done, 200

		after ->
			MockWebApi.getDocument.restore()

		it "should not need to call the web api", ->
			MockWebApi.getDocument.called.should.equal false

		it "should update the doc", (done) ->
			DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				doc.lines.should.deep.equal @result
				done()

		it "should push the applied updates to the track changes api", (done) ->
			rclient.lrange "UncompressedHistoryOps:#{@doc_id}", 0, -1, (error, updates) =>
				JSON.parse(updates[0]).op.should.deep.equal @update.op
				rclient.sismember "DocsWithHistoryOps:#{@project_id}", @doc_id, (error, result) =>
					result.should.equal 1
					done()

	describe "when the document has been deleted", ->
		describe "when the ops come in a single linear order", ->
			before (done) ->
				[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
				lines = ["", "", ""]
				MockWebApi.insertDoc @project_id, @doc_id, lines: lines
				db.docOps.insert doc_id: ObjectId(@doc_id), version: 0, (error) =>
					throw error if error?
					@updates = [
						{ doc_id: @doc_id, v: 0,  op: [i: "h", p: 0 ] }
						{ doc_id: @doc_id, v: 1,  op: [i: "e", p: 1 ] }
						{ doc_id: @doc_id, v: 2,  op: [i: "l", p: 2 ] }
						{ doc_id: @doc_id, v: 3,  op: [i: "l", p: 3 ] }
						{ doc_id: @doc_id, v: 4,  op: [i: "o", p: 4 ] }
						{ doc_id: @doc_id, v: 5,  op: [i: " ", p: 5 ] }
						{ doc_id: @doc_id, v: 6,  op: [i: "w", p: 6 ] }
						{ doc_id: @doc_id, v: 7,  op: [i: "o", p: 7 ] }
						{ doc_id: @doc_id, v: 8,  op: [i: "r", p: 8 ] }
						{ doc_id: @doc_id, v: 9,  op: [i: "l", p: 9 ] }
						{ doc_id: @doc_id, v: 10, op: [i: "d", p: 10] }
					]
					@my_result = ["hello world", "", ""]
					done()

			it "should be able to continue applying updates when the project has been deleted", (done) ->
				actions = []
				for update in @updates.slice(0,6)
					do (update) =>
						actions.push (callback) => DocUpdaterClient.sendUpdate @project_id, @doc_id, update, callback
				actions.push (callback) => DocUpdaterClient.deleteDoc @project_id, @doc_id, callback
				for update in @updates.slice(6)
					do (update) =>
						actions.push (callback) => DocUpdaterClient.sendUpdate @project_id, @doc_id, update, callback

				async.series actions, (error) =>
					throw error if error?
					DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
						doc.lines.should.deep.equal @my_result
						done()

			it "should push the applied updates to the track changes api", (done) ->
				rclient.lrange "UncompressedHistoryOps:#{@doc_id}", 0, -1, (error, updates) =>
					updates = (JSON.parse(u) for u in updates)
					for appliedUpdate, i in @updates
						appliedUpdate.op.should.deep.equal updates[i].op

					rclient.sismember "DocsWithHistoryOps:#{@project_id}", @doc_id, (error, result) =>
						result.should.equal 1
						done()

		describe "when older ops come in after the delete", ->
			before (done) ->
				[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
				lines = ["", "", ""]
				MockWebApi.insertDoc @project_id, @doc_id, lines: lines
				db.docOps.insert doc_id: ObjectId(@doc_id), version: 0, (error) =>
					throw error if error?

					@updates = [
						{ doc_id: @doc_id, v: 0, op: [i: "h", p: 0 ] }
						{ doc_id: @doc_id, v: 1, op: [i: "e", p: 1 ] }
						{ doc_id: @doc_id, v: 2, op: [i: "l", p: 2 ] }
						{ doc_id: @doc_id, v: 3, op: [i: "l", p: 3 ] }
						{ doc_id: @doc_id, v: 4, op: [i: "o", p: 4 ] }
						{ doc_id: @doc_id, v: 0, op: [i: "world", p: 1 ] }
					]
					@my_result = ["hello", "world", ""]

					done()

			it "should be able to continue applying updates when the project has been deleted", (done) ->
				actions = []
				for update in @updates.slice(0,5)
					do (update) =>
						actions.push (callback) => DocUpdaterClient.sendUpdate @project_id, @doc_id, update, callback
				actions.push (callback) => DocUpdaterClient.deleteDoc @project_id, @doc_id, callback
				for update in @updates.slice(5)
					do (update) =>
						actions.push (callback) => DocUpdaterClient.sendUpdate @project_id, @doc_id, update, callback

				async.series actions, (error) =>
					throw error if error?
					DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
						doc.lines.should.deep.equal @my_result
						done()

	describe "with a broken update", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			MockWebApi.insertDoc @project_id, @doc_id, lines: @lines
			db.docOps.insert doc_id: ObjectId(@doc_id), version: @version, (error) =>
				throw error if error?
				DocUpdaterClient.sendUpdate @project_id, @doc_id, @undefined, (error) ->
					throw error if error?
					setTimeout done, 200

		it "should not update the doc", (done) ->
			DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				doc.lines.should.deep.equal @lines
				done()

	describe "with enough updates to flush to the track changes api", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			updates = []
			for v in [0..99] # Should flush after 50 ops
				updates.push
					doc_id: @doc_id,
					op: [i: v.toString(), p: 0]
					v: v

			sinon.spy MockTrackChangesApi, "flushDoc"

			MockWebApi.insertDoc @project_id, @doc_id, lines: @lines
			db.docOps.insert doc_id: ObjectId(@doc_id), version: 0, (error) =>
				throw error if error?
				DocUpdaterClient.sendUpdates @project_id, @doc_id, updates, (error) =>
					throw error if error?
					setTimeout done, 200

		after ->
			MockTrackChangesApi.flushDoc.restore()

		it "should flush the doc twice", ->
			MockTrackChangesApi.flushDoc.calledTwice.should.equal true

	describe "when there is no version in Mongo", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			MockWebApi.insertDoc @project_id, @doc_id, {
				lines: @lines
			}

			update = 
				doc: @doc_id
				op: @update.op
				v: 0
			DocUpdaterClient.sendUpdate @project_id, @doc_id, update, (error) ->
				throw error if error?
				setTimeout done, 200

		it "should update the doc (using version = 0)", (done) ->
			DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				doc.lines.should.deep.equal @result
				done()

