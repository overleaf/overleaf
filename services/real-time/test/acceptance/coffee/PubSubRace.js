RealTimeClient = require "./helpers/RealTimeClient"
MockDocUpdaterServer = require "./helpers/MockDocUpdaterServer"
FixturesManager = require "./helpers/FixturesManager"

async = require "async"

settings = require "settings-sharelatex"
redis = require "redis-sharelatex"
rclient = redis.createClient(settings.redis.pubsub)

describe "PubSubRace", ->
	before (done) ->
		MockDocUpdaterServer.run done

	describe "when the client leaves a doc before joinDoc completes", ->
		before (done) ->
			async.series [
				(cb) =>
					FixturesManager.setUpProject {
						privilegeLevel: "owner"
						project: {
							name: "Test Project"
						}
					}, (e, {@project_id, @user_id}) => cb()

				(cb) =>
					@clientA = RealTimeClient.connect()
					@clientA.on "connect", cb

				(cb) =>
					@clientA.emit "joinProject", project_id: @project_id, (error, @project, @privilegeLevel, @protocolVersion) =>
						cb(error)

				(cb) =>
					FixturesManager.setUpDoc @project_id, {@lines, @version, @ops}, (e, {@doc_id}) =>
						cb(e)

				(cb) =>
					@clientA.emit "joinDoc", @doc_id, () ->
					# leave before joinDoc completes
					@clientA.emit "leaveDoc", @doc_id, cb

				(cb) =>
					# wait for subscribe and unsubscribe
					setTimeout cb, 100
			], done

		it "should not subscribe to the applied-ops channels anymore", (done) ->
			rclient.pubsub 'CHANNELS', (err, resp) =>
				return done(err) if err
				resp.should.not.include "applied-ops:#{@doc_id}"
				done()
			return null

	describe "when the client emits joinDoc and leaveDoc requests frequently and leaves eventually", ->
		before (done) ->
			async.series [
				(cb) =>
					FixturesManager.setUpProject {
						privilegeLevel: "owner"
						project: {
							name: "Test Project"
						}
					}, (e, {@project_id, @user_id}) => cb()

				(cb) =>
					@clientA = RealTimeClient.connect()
					@clientA.on "connect", cb

				(cb) =>
					@clientA.emit "joinProject", project_id: @project_id, (error, @project, @privilegeLevel, @protocolVersion) =>
						cb(error)

				(cb) =>
					FixturesManager.setUpDoc @project_id, {@lines, @version, @ops}, (e, {@doc_id}) =>
						cb(e)

				(cb) =>
					@clientA.emit "joinDoc", @doc_id, () ->
					@clientA.emit "leaveDoc", @doc_id, () ->
					@clientA.emit "joinDoc", @doc_id, () ->
					@clientA.emit "leaveDoc", @doc_id, () ->
					@clientA.emit "joinDoc", @doc_id, () ->
					@clientA.emit "leaveDoc", @doc_id, () ->
					@clientA.emit "joinDoc", @doc_id, () ->
					@clientA.emit "leaveDoc", @doc_id, () ->
					@clientA.emit "joinDoc", @doc_id, () ->
					@clientA.emit "leaveDoc", @doc_id, cb

				(cb) =>
					# wait for subscribe and unsubscribe
					setTimeout cb, 100
			], done

		it "should not subscribe to the applied-ops channels anymore", (done) ->
			rclient.pubsub 'CHANNELS', (err, resp) =>
				return done(err) if err
				resp.should.not.include "applied-ops:#{@doc_id}"
				done()
			return null

	describe "when the client emits joinDoc and leaveDoc requests frequently and remains in the doc", ->
		before (done) ->
			async.series [
				(cb) =>
					FixturesManager.setUpProject {
						privilegeLevel: "owner"
						project: {
							name: "Test Project"
						}
					}, (e, {@project_id, @user_id}) => cb()

				(cb) =>
					@clientA = RealTimeClient.connect()
					@clientA.on "connect", cb

				(cb) =>
					@clientA.emit "joinProject", project_id: @project_id, (error, @project, @privilegeLevel, @protocolVersion) =>
						cb(error)

				(cb) =>
					FixturesManager.setUpDoc @project_id, {@lines, @version, @ops}, (e, {@doc_id}) =>
						cb(e)

				(cb) =>
					@clientA.emit "joinDoc", @doc_id, () ->
					@clientA.emit "leaveDoc", @doc_id, () ->
					@clientA.emit "joinDoc", @doc_id, () ->
					@clientA.emit "leaveDoc", @doc_id, () ->
					@clientA.emit "joinDoc", @doc_id, () ->
					@clientA.emit "leaveDoc", @doc_id, () ->
					@clientA.emit "joinDoc", @doc_id, () ->
					@clientA.emit "leaveDoc", @doc_id, () ->
					@clientA.emit "joinDoc", @doc_id, cb

				(cb) =>
					# wait for subscribe and unsubscribe
					setTimeout cb, 100
			], done

		it "should subscribe to the applied-ops channels", (done) ->
			rclient.pubsub 'CHANNELS', (err, resp) =>
				return done(err) if err
				resp.should.include "applied-ops:#{@doc_id}"
				done()
			return null

	describe "when the client disconnects before joinDoc completes", ->
		before (done) ->
			async.series [
				(cb) =>
					FixturesManager.setUpProject {
						privilegeLevel: "owner"
						project: {
							name: "Test Project"
						}
					}, (e, {@project_id, @user_id}) => cb()

				(cb) =>
					@clientA = RealTimeClient.connect()
					@clientA.on "connect", cb

				(cb) =>
					@clientA.emit "joinProject", project_id: @project_id, (error, @project, @privilegeLevel, @protocolVersion) =>
						cb(error)

				(cb) =>
					FixturesManager.setUpDoc @project_id, {@lines, @version, @ops}, (e, {@doc_id}) =>
						cb(e)

				(cb) =>
					joinDocCompleted = false
					@clientA.emit "joinDoc", @doc_id, () ->
						joinDocCompleted = true
					# leave before joinDoc completes
					setTimeout () =>
						if joinDocCompleted
							return cb(new Error('joinDocCompleted -- lower timeout'))
						@clientA.on "disconnect", () -> cb()
						@clientA.disconnect()
					# socket.io processes joinDoc and disconnect with different delays:
					#  - joinDoc goes through two process.nextTick
					#  - disconnect goes through one process.nextTick
					# We have to inject the disconnect event into a different event loop
					#  cycle.
					, 3

				(cb) =>
					# wait for subscribe and unsubscribe
					setTimeout cb, 100
			], done

		it "should not subscribe to the editor-events channels anymore", (done) ->
			rclient.pubsub 'CHANNELS', (err, resp) =>
				return done(err) if err
				resp.should.not.include "editor-events:#{@project_id}"
				done()
			return null

		it "should not subscribe to the applied-ops channels anymore", (done) ->
			rclient.pubsub 'CHANNELS', (err, resp) =>
				return done(err) if err
				resp.should.not.include "applied-ops:#{@doc_id}"
				done()
			return null
