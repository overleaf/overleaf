sinon = require "sinon"
chai = require("chai")
chai.should()
expect = chai.expect
async = require "async"
Settings = require('settings-sharelatex')
rclient_history = require("redis-sharelatex").createClient(Settings.redis.history) # note: this is track changes, not project-history
rclient_project_history = require("redis-sharelatex").createClient(Settings.redis.project_history)
rclient_du = require("redis-sharelatex").createClient(Settings.redis.documentupdater)
Keys = Settings.redis.documentupdater.key_schema
HistoryKeys = Settings.redis.history.key_schema
ProjectHistoryKeys = Settings.redis.project_history.key_schema

MockTrackChangesApi = require "./helpers/MockTrackChangesApi"
MockWebApi = require "./helpers/MockWebApi"
DocUpdaterClient = require "./helpers/DocUpdaterClient"
DocUpdaterApp = require "./helpers/DocUpdaterApp"

describe "Applying updates to a doc", ->
	before (done) ->
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
		DocUpdaterApp.ensureRunning(done)

	describe "when the document is not loaded", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			sinon.spy MockWebApi, "getDocument"
			@startTime = Date.now()
			MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version}
			DocUpdaterClient.sendUpdate @project_id, @doc_id, @update, (error) ->
				throw error if error?
				setTimeout done, 200
			return null

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
			return null

		it "should push the applied updates to the track changes api", (done) ->
			rclient_history.lrange HistoryKeys.uncompressedHistoryOps({@doc_id}), 0, -1, (error, updates) =>
				throw error if error?
				JSON.parse(updates[0]).op.should.deep.equal @update.op
				rclient_history.sismember HistoryKeys.docsWithHistoryOps({@project_id}), @doc_id, (error, result) =>
					throw error if error?
					result.should.equal 1
					done()
			return null

		it "should push the applied updates to the project history changes api", (done) ->
			rclient_project_history.lrange ProjectHistoryKeys.projectHistoryOps({@project_id}), 0, -1, (error, updates) =>
				throw error if error?
				JSON.parse(updates[0]).op.should.deep.equal @update.op
				done()
			return null

		it "should set the first op timestamp", (done) ->
			rclient_project_history.get ProjectHistoryKeys.projectHistoryFirstOpTimestamp({@project_id}), (error, result) =>
				throw error if error?
				result.should.be.within(@startTime, Date.now())
				@firstOpTimestamp = result
				done()
			return null

		describe "when sending another update", ->
			before (done) ->
				@timeout = 10000
				@second_update = Object.create(@update)
				@second_update.v = @version + 1
				DocUpdaterClient.sendUpdate @project_id, @doc_id, @second_update, (error) ->
					throw error if error?
					setTimeout done, 200
				return null

			it "should not change the first op timestamp", (done) ->
				rclient_project_history.get ProjectHistoryKeys.projectHistoryFirstOpTimestamp({@project_id}), (error, result) =>
					throw error if error?
					result.should.equal @firstOpTimestamp
					done()
				return null

	describe "when the document is loaded", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]

			MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version}
			DocUpdaterClient.preloadDoc @project_id, @doc_id, (error) =>
				throw error if error?
				sinon.spy MockWebApi, "getDocument"
				DocUpdaterClient.sendUpdate @project_id, @doc_id, @update, (error) ->
					throw error if error?
					setTimeout done, 200
			return null

		after ->
			MockWebApi.getDocument.restore()

		it "should not need to call the web api", ->
			MockWebApi.getDocument.called.should.equal false

		it "should update the doc", (done) ->
			DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				doc.lines.should.deep.equal @result
				done()
			return null

		it "should push the applied updates to the track changes api", (done) ->
			rclient_history.lrange HistoryKeys.uncompressedHistoryOps({@doc_id}), 0, -1, (error, updates) =>
				JSON.parse(updates[0]).op.should.deep.equal @update.op
				rclient_history.sismember HistoryKeys.docsWithHistoryOps({@project_id}), @doc_id, (error, result) =>
					result.should.equal 1
					done()
			return null

		it "should push the applied updates to the project history changes api", (done) ->
			rclient_project_history.lrange ProjectHistoryKeys.projectHistoryOps({@project_id}), 0, -1, (error, updates) =>
				JSON.parse(updates[0]).op.should.deep.equal @update.op
				done()
			return null

	describe "when the document is loaded and is using project-history only", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]

			MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version, projectHistoryType: 'project-history'}
			DocUpdaterClient.preloadDoc @project_id, @doc_id, (error) =>
				throw error if error?
				sinon.spy MockWebApi, "getDocument"
				DocUpdaterClient.sendUpdate @project_id, @doc_id, @update, (error) ->
					throw error if error?
					setTimeout done, 200
			return null

		after ->
			MockWebApi.getDocument.restore()

		it "should update the doc", (done) ->
			DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				doc.lines.should.deep.equal @result
				done()
			return null

		it "should not push any applied updates to the track changes api", (done) ->
			rclient_history.lrange HistoryKeys.uncompressedHistoryOps({@doc_id}), 0, -1, (error, updates) =>
				updates.length.should.equal 0
				done()
			return null

		it "should push the applied updates to the project history changes api", (done) ->
			rclient_project_history.lrange ProjectHistoryKeys.projectHistoryOps({@project_id}), 0, -1, (error, updates) =>
				JSON.parse(updates[0]).op.should.deep.equal @update.op
				done()
			return null

	describe "when the document has been deleted", ->
		describe "when the ops come in a single linear order", ->
			before (done) ->
				[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
				lines = ["", "", ""]
				MockWebApi.insertDoc @project_id, @doc_id, {lines: lines, version: 0}
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
				return null

			it "should push the applied updates to the track changes api", (done) ->
				rclient_history.lrange HistoryKeys.uncompressedHistoryOps({@doc_id}), 0, -1, (error, updates) =>
					updates = (JSON.parse(u) for u in updates)
					for appliedUpdate, i in @updates
						appliedUpdate.op.should.deep.equal updates[i].op

					rclient_history.sismember HistoryKeys.docsWithHistoryOps({@project_id}), @doc_id, (error, result) =>
						result.should.equal 1
						done()
				return null

			it "should store the doc ops in the correct order", (done) ->
				rclient_du.lrange Keys.docOps({doc_id: @doc_id}), 0, -1, (error, updates) =>
					updates = (JSON.parse(u) for u in updates)
					for appliedUpdate, i in @updates
						appliedUpdate.op.should.deep.equal updates[i].op
					done()
				return null

		describe "when older ops come in after the delete", ->
			before (done) ->
				[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
				lines = ["", "", ""]
				MockWebApi.insertDoc @project_id, @doc_id, {lines: lines, version: 0}
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
				return null

	describe "with a broken update", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			@broken_update = { doc_id: @doc_id, v: @version, op: [d: "not the correct content", p: 0 ] }
			MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version}

			DocUpdaterClient.subscribeToAppliedOps @messageCallback = sinon.stub()

			DocUpdaterClient.sendUpdate @project_id, @doc_id, @broken_update, (error) ->
				throw error if error?
				setTimeout done, 200
			return null

		it "should not update the doc", (done) ->
			DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				doc.lines.should.deep.equal @lines
				done()
			return null

		it "should send a message with an error", ->
			@messageCallback.called.should.equal true
			[channel, message] = @messageCallback.args[0]
			channel.should.equal "applied-ops"
			JSON.parse(message).should.deep.include {
				project_id: @project_id,
				doc_id: @doc_id,
				error:'Delete component does not match'
			}

	describe "with enough updates to flush to the track changes api", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			updates = []
			for v in [0..199] # Should flush after 100 ops
				updates.push
					doc_id: @doc_id,
					op: [i: v.toString(), p: 0]
					v: v

			sinon.spy MockTrackChangesApi, "flushDoc"

			MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: 0}

			# Send updates in chunks to causes multiple flushes
			actions = []
			for i in [0..19]
				do (i) =>
					actions.push (cb) =>
						DocUpdaterClient.sendUpdates @project_id, @doc_id, updates.slice(i*10, (i+1)*10), cb
			async.series actions, (error) =>
				throw error if error?
				setTimeout done, 2000
			return null

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
			return null

		it "should update the doc (using version = 0)", (done) ->
			DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				doc.lines.should.deep.equal @result
				done()
			return null

	describe "when the sending duplicate ops", ->
		before (done) ->
			[@project_id, @doc_id] = [DocUpdaterClient.randomId(), DocUpdaterClient.randomId()]
			MockWebApi.insertDoc @project_id, @doc_id, {lines: @lines, version: @version}

			DocUpdaterClient.subscribeToAppliedOps @messageCallback = sinon.stub()

			# One user delete 'one', the next turns it into 'once'. The second becomes a NOP.
			DocUpdaterClient.sendUpdate @project_id, @doc_id, {
				doc: @doc_id
				op: [{
					i: "one and a half\n"
					p: 4
				}]
				v: @version
				meta:
					source: "ikHceq3yfAdQYzBo4-xZ"
			}, (error) =>
				throw error if error?
				setTimeout () =>
					DocUpdaterClient.sendUpdate @project_id, @doc_id, {
						doc: @doc_id
						op: [{
							i: "one and a half\n"
							p: 4
						}]
						v: @version
						dupIfSource: ["ikHceq3yfAdQYzBo4-xZ"]
						meta:
							source: "ikHceq3yfAdQYzBo4-xZ"
					}, (error) =>
						throw error if error?
						setTimeout done, 200
				, 200
			return null

		it "should update the doc", (done) ->
			DocUpdaterClient.getDoc @project_id, @doc_id, (error, res, doc) =>
				doc.lines.should.deep.equal @result
				done()
			return null

		it "should return a message about duplicate ops", ->
			@messageCallback.calledTwice.should.equal true
			@messageCallback.args[0][0].should.equal "applied-ops"
			expect(JSON.parse(@messageCallback.args[0][1]).op.dup).to.be.undefined
			@messageCallback.args[1][0].should.equal "applied-ops"
			expect(JSON.parse(@messageCallback.args[1][1]).op.dup).to.equal true

