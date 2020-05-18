RealTimeClient = require "./helpers/RealTimeClient"
MockDocUpdaterServer = require "./helpers/MockDocUpdaterServer"
FixturesManager = require "./helpers/FixturesManager"

async = require "async"

settings = require "settings-sharelatex"
redis = require "redis-sharelatex"
rclient = redis.createClient(settings.redis.pubsub)

describe "leaveProject", ->
	before (done) ->
		MockDocUpdaterServer.run done

	describe "with other clients in the project", ->
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
					@clientA.on "connectionAccepted", cb

				(cb) =>
					@clientB = RealTimeClient.connect()
					@clientB.on "connectionAccepted", cb

					@clientBDisconnectMessages = []
					@clientB.on "clientTracking.clientDisconnected", (data) =>
						@clientBDisconnectMessages.push data

				(cb) =>
					@clientA.emit "joinProject", project_id: @project_id, (error, @project, @privilegeLevel, @protocolVersion) =>
						cb(error)

				(cb) =>
					@clientB.emit "joinProject", project_id: @project_id, (error, @project, @privilegeLevel, @protocolVersion) =>
						cb(error)

				(cb) =>
					FixturesManager.setUpDoc @project_id, {@lines, @version, @ops}, (e, {@doc_id}) =>
						cb(e)

				(cb) =>
					@clientA.emit "joinDoc", @doc_id, cb
				(cb) =>
					@clientB.emit "joinDoc", @doc_id, cb

				(cb) =>
					# leaveProject is called when the client disconnects
					@clientA.on "disconnect", () -> cb()
					@clientA.disconnect()

				(cb) =>
					# The API waits a little while before flushing changes
					setTimeout done, 1000

			], done

		it "should emit a disconnect message to the room", ->
			@clientBDisconnectMessages.should.deep.equal [@clientA.socket.sessionid]

		it "should no longer list the client in connected users", (done) ->
			@clientB.emit "clientTracking.getConnectedUsers", (error, users) =>
				for user in users
					if user.client_id == @clientA.socket.sessionid
						throw "Expected clientA to not be listed in connected users"
				return done()

		it "should not flush the project to the document updater", ->
			MockDocUpdaterServer.deleteProject
				.calledWith(@project_id)
				.should.equal false

		it "should remain subscribed to the editor-events channels", (done) ->
			rclient.pubsub 'CHANNELS', (err, resp) =>
				return done(err) if err
				resp.should.include "editor-events:#{@project_id}"
				done()
			return null

		it "should remain subscribed to the applied-ops channels", (done) ->
			rclient.pubsub 'CHANNELS', (err, resp) =>
				return done(err) if err
				resp.should.include "applied-ops:#{@doc_id}"
				done()
			return null

	describe "with no other clients in the project", ->
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
					@clientA.emit "joinDoc", @doc_id, cb

				(cb) =>
					# leaveProject is called when the client disconnects
					@clientA.on "disconnect", () -> cb()
					@clientA.disconnect()

				(cb) =>
					# The API waits a little while before flushing changes
					setTimeout done, 1000
			], done

		it "should flush the project to the document updater", ->
			MockDocUpdaterServer.deleteProject
				.calledWith(@project_id)
				.should.equal true

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
