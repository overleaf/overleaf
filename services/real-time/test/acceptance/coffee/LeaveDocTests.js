chai = require("chai")
expect = chai.expect
chai.should()
sinon = require("sinon")

RealTimeClient = require "./helpers/RealTimeClient"
MockDocUpdaterServer = require "./helpers/MockDocUpdaterServer"
FixturesManager = require "./helpers/FixturesManager"
logger = require("logger-sharelatex")

async = require "async"

describe "leaveDoc", ->
	before ->
		@lines = ["test", "doc", "lines"]
		@version = 42
		@ops = ["mock", "doc", "ops"]
		sinon.spy(logger, "error")
		sinon.spy(logger, "warn")
		sinon.spy(logger, "log")
		@other_doc_id = FixturesManager.getRandomId()
	
	after ->
		logger.error.restore() # remove the spy
		logger.warn.restore()
		logger.log.restore()

	describe "when joined to a doc", ->
		beforeEach (done) ->
			async.series [
				(cb) =>
					FixturesManager.setUpProject {
						privilegeLevel: "readAndWrite"
					}, (e, {@project_id, @user_id}) =>
						cb(e)
					
				(cb) =>
					FixturesManager.setUpDoc @project_id, {@lines, @version, @ops}, (e, {@doc_id}) =>
						cb(e)
						
				(cb) =>
					@client = RealTimeClient.connect()
					@client.on "connectionAccepted", cb
						
				(cb) =>
					@client.emit "joinProject", project_id: @project_id, cb
				
				(cb) =>
					@client.emit "joinDoc", @doc_id, (error, @returnedArgs...) => cb(error)
			], done
							
		describe "then leaving the doc", ->
			beforeEach (done) ->
				@client.emit "leaveDoc", @doc_id, (error) ->
					throw error if error?
					done()
			
			it "should have left the doc room", (done) ->
				RealTimeClient.getConnectedClient @client.socket.sessionid, (error, client) =>
					expect(@doc_id in client.rooms).to.equal false
					done()

		describe "when sending a leaveDoc request before the previous joinDoc request has completed", ->
			beforeEach (done) ->
				@client.emit "leaveDoc", @doc_id, () ->
				@client.emit "joinDoc", @doc_id, () ->
				@client.emit "leaveDoc", @doc_id, (error) ->
					throw error if error?
					done()

			it "should not trigger an error", ->
				sinon.assert.neverCalledWith(logger.error, sinon.match.any, "not subscribed - shouldn't happen")

			it "should have left the doc room", (done) ->
				RealTimeClient.getConnectedClient @client.socket.sessionid, (error, client) =>
					expect(@doc_id in client.rooms).to.equal false
					done()

		describe "when sending a leaveDoc for a room the client has not joined ", ->
			beforeEach (done) ->
				@client.emit "leaveDoc", @other_doc_id, (error) ->
					throw error if error?
					done()

			it "should trigger a low level message only", ->
				sinon.assert.calledWith(logger.log, sinon.match.any, "ignoring request from client to leave room it is not in")
