sinon = require "sinon"
chai = require("chai")
chai.should()
async = require "async"
mongojs = require "../../../app/js/mongojs"
db = mongojs.db
ObjectId = mongojs.ObjectId
rclient = require("redis").createClient()

MockWebApi = require "./helpers/MockWebApi"
DocUpdaterClient = require "./helpers/DocUpdaterClient"

describe "Applying updates to a doc", ->
	before ->
		@lines = ["one", "two", "three"]
		@update =
			doc: @doc_id
			op: [{
				i: "one and a half\n"
				p: 4
			}]
			v: 0
		@result = ["one", "one and a half", "two", "three"]

	describe "when the document is not loaded", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			MockWebApi.insertDoc @project_id, @doc_id, {
				lines: @lines
			}
			sinon.spy MockWebApi, "getDocument"
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
				JSON.parse(updates[0]).op.should.deep.equal @update.op
				done()

	describe "when the document is loaded", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			MockWebApi.insertDoc @project_id, @doc_id, {
				lines: @lines
			}
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
				done()

	describe "when the document has been deleted", ->
		describe "when the ops come in a single linear order", ->
			before ->
				[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
				@lines = ["", "", ""]
				MockWebApi.insertDoc @project_id, @doc_id, {
					lines: @lines
				}

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
				@result = ["hello world", "", ""]
				MockWebApi.insertDoc @project_id, @doc_id, {
					lines: @lines
				}

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
						doc.lines.should.deep.equal @result
						done()

			it "should push the applied updates to the track changes api", (done) ->
				rclient.lrange "UncompressedHistoryOps:#{@doc_id}", 0, -1, (error, updates) =>
					updates = (JSON.parse(u) for u in updates)
					for appliedUpdate, i in @updates
						appliedUpdate.op.should.deep.equal updates[i].op
					done()

		describe "when older ops come in after the delete", ->
			before ->
				[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
				@lines = ["", "", ""]
				MockWebApi.insertDoc @project_id, @doc_id, {
					lines: @lines
				}

				@updates = [
					{ doc_id: @doc_id, v: 0, op: [i: "h", p: 0 ] }
					{ doc_id: @doc_id, v: 1, op: [i: "e", p: 1 ] }
					{ doc_id: @doc_id, v: 2, op: [i: "l", p: 2 ] }
					{ doc_id: @doc_id, v: 3, op: [i: "l", p: 3 ] }
					{ doc_id: @doc_id, v: 4, op: [i: "o", p: 4 ] }
					{ doc_id: @doc_id, v: 0, op: [i: "world", p: 1 ] }
				]
				@result = ["hello", "world", ""]
				MockWebApi.insertDoc @project_id, @doc_id, {
					lines: @lines
				}

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
						doc.lines.should.deep.equal @result
						done()
		
	describe "when the mongo array has been trimmed", ->
		before ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			@lines = ["", "", ""]
			MockWebApi.insertDoc @project_id, @doc_id, {
				lines: @lines
			}

			@updates = [
				{ doc_id: @doc_id, v: 0, op: [i: "h", p: 0 ] }
				{ doc_id: @doc_id, v: 1, op: [i: "e", p: 1 ] }
				{ doc_id: @doc_id, v: 2, op: [i: "l", p: 2 ] }
				{ doc_id: @doc_id, v: 3, op: [i: "l", p: 3 ] }
				{ doc_id: @doc_id, v: 4, op: [i: "o", p: 4 ] }
				{ doc_id: @doc_id, v: 3, op: [i: "world", p: 4 ] }
			]
			@result = ["hello", "world", ""]
			MockWebApi.insertDoc @project_id, @doc_id, {
				lines: @lines
			}

		it "should be able to reload the required ops from the trimmed mongo array", (done) ->
			actions = []
			# Apply first set of ops
			for update in @updates.slice(0,5)
				do (update) =>
					actions.push (callback) => DocUpdaterClient.sendUpdate @project_id, @doc_id, update, callback
			# Delete doc from redis and trim ops back to version 3
			actions.push (callback) => DocUpdaterClient.deleteDoc @project_id, @doc_id, callback
			actions.push (callback) =>
				db.docOps.update({doc_id: ObjectId(@doc_id)}, {$push: docOps: { $each: [], $slice: -2 }}, callback)
			# Apply older update back from version 3
			for update in @updates.slice(5)
				do (update) =>
					actions.push (callback) => DocUpdaterClient.sendUpdate @project_id, @doc_id, update, callback
			# Flush ops to mongo
			actions.push (callback) => DocUpdaterClient.flushDoc @project_id, @doc_id, callback

			async.series actions, (error) =>
				throw error if error?
				DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
					db.docOps.find {doc_id: ObjectId(@doc_id)}, (error, docOps) =>
						# Check mongo array has been trimmed
						docOps = docOps[0]
						docOps.docOps.length.should.equal 3
						# Check ops have all be applied properly
						doc.lines.should.deep.equal @result
						done()

	describe "with a broken update", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			MockWebApi.insertDoc @project_id, @doc_id, {
				lines: @lines
			}
			DocUpdaterClient.sendUpdate @project_id, @doc_id, @undefined, (error) ->
				throw error if error?
				setTimeout done, 200

		it "should not update the doc", (done) ->
			DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				doc.lines.should.deep.equal @lines
				done()
	
