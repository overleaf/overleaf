async = require "async"
{expect} = require("chai")

RealTimeClient = require "./helpers/RealTimeClient"
MockDocUpdaterServer = require "./helpers/MockDocUpdaterServer"
MockWebServer = require "./helpers/MockWebServer"
FixturesManager = require "./helpers/FixturesManager"

settings = require "settings-sharelatex"
redis = require "redis-sharelatex"
rclient = redis.createClient(settings.redis.pubsub)
rclientRT = redis.createClient(settings.redis.realtime)
KeysRT = settings.redis.realtime.key_schema

describe "EarlyDisconnect", ->
	before (done) ->
		MockDocUpdaterServer.run done

	describe "when the client disconnects before joinProject completes", ->
		before () ->
			# slow down web-api requests to force the race condition
			@actualWebAPIjoinProject = joinProject = MockWebServer.joinProject
			MockWebServer.joinProject = (project_id, user_id, cb) ->
				setTimeout () ->
					joinProject(project_id, user_id, cb)
				, 300

		after () ->
			MockWebServer.joinProject = @actualWebAPIjoinProject

		beforeEach (done) ->
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
					@clientA.on "connectionAccepted", cb

				(cb) =>
					@clientA.emit "joinProject", project_id: @project_id, (() ->)
					# disconnect before joinProject completes
					@clientA.on "disconnect", () -> cb()
					@clientA.disconnect()

				(cb) =>
					# wait for joinDoc and subscribe
					setTimeout cb, 500
			], done

		# we can force the race condition, there is no need to repeat too often
		for attempt in Array.from(length: 5).map((_, i) -> i+1)
			it "should not subscribe to the pub/sub channel anymore (race #{attempt})", (done) ->
				rclient.pubsub 'CHANNELS', (err, resp) =>
					return done(err) if err
					expect(resp).to.not.include "editor-events:#{@project_id}"
					done()
				return null

	describe "when the client disconnects before joinDoc completes", ->
		beforeEach (done) ->
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
					@clientA.on "connectionAccepted", cb

				(cb) =>
					@clientA.emit "joinProject", project_id: @project_id, (error, @project, @privilegeLevel, @protocolVersion) =>
						cb(error)

				(cb) =>
					FixturesManager.setUpDoc @project_id, {@lines, @version, @ops}, (e, {@doc_id}) =>
						cb(e)

				(cb) =>
					@clientA.emit "joinDoc", @doc_id, (() ->)
					# disconnect before joinDoc completes
					@clientA.on "disconnect", () -> cb()
					@clientA.disconnect()

				(cb) =>
					# wait for subscribe and unsubscribe
					setTimeout cb, 100
			], done

		# we can not force the race condition, so we have to try many times
		for attempt in Array.from(length: 20).map((_, i) -> i+1)
			it "should not subscribe to the pub/sub channels anymore (race #{attempt})", (done) ->
				rclient.pubsub 'CHANNELS', (err, resp) =>
					return done(err) if err
					expect(resp).to.not.include "editor-events:#{@project_id}"

					rclient.pubsub 'CHANNELS', (err, resp) =>
						return done(err) if err
						expect(resp).to.not.include "applied-ops:#{@doc_id}"
						done()
				return null

	describe "when the client disconnects before clientTracking.updatePosition starts", ->
		beforeEach (done) ->
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
					@clientA.on "connectionAccepted", cb

				(cb) =>
					@clientA.emit "joinProject", project_id: @project_id, (error, @project, @privilegeLevel, @protocolVersion) =>
						cb(error)

				(cb) =>
					FixturesManager.setUpDoc @project_id, {@lines, @version, @ops}, (e, {@doc_id}) =>
						cb(e)

				(cb) =>
					@clientA.emit "joinDoc", @doc_id, cb

				(cb) =>
					@clientA.emit "clientTracking.updatePosition", {
							row: 42
							column: 36
							doc_id: @doc_id
						}, (() ->)
					# disconnect before updateClientPosition completes
					@clientA.on "disconnect", () -> cb()
					@clientA.disconnect()

				(cb) =>
					# wait for updateClientPosition
					setTimeout cb, 100
			], done

		# we can not force the race condition, so we have to try many times
		for attempt in Array.from(length: 20).map((_, i) -> i+1)
			it "should not show the client as connected (race #{attempt})", (done) ->
				rclientRT.smembers KeysRT.clientsInProject({project_id: @project_id}), (err, results) ->
					return done(err) if err
					expect(results).to.deep.equal([])
					done()
				return null
