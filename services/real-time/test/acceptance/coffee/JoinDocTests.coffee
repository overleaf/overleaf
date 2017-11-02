chai = require("chai")
expect = chai.expect
chai.should()

RealTimeClient = require "./helpers/RealTimeClient"
MockDocUpdaterServer = require "./helpers/MockDocUpdaterServer"
FixturesManager = require "./helpers/FixturesManager"

async = require "async"

describe "joinDoc", ->
	before ->
		@lines = ["test", "doc", "lines"]
		@version = 42
		@ops = ["mock", "doc", "ops"]
		@ranges = {"mock": "ranges"}
			
	describe "when authorised readAndWrite", ->
		before (done) ->
			async.series [
				(cb) =>
					FixturesManager.setUpProject {
						privilegeLevel: "readAndWrite"
					}, (e, {@project_id, @user_id}) =>
						cb(e)
					
				(cb) =>
					FixturesManager.setUpDoc @project_id, {@lines, @version, @ops, @ranges}, (e, {@doc_id}) =>
						cb(e)

				(cb) =>
					@client = RealTimeClient.connect()
					@client.on "connectionAccepted", cb
						
				(cb) =>
					@client.emit "joinProject", project_id: @project_id, cb
				
				(cb) =>
					@client.emit "joinDoc", @doc_id, (error, @returnedArgs...) => cb(error)
			], done

		it "should get the doc from the doc updater", ->
			MockDocUpdaterServer.getDocument
				.calledWith(@project_id, @doc_id, -1)
				.should.equal true
		
		it "should return the doc lines, version, ranges and ops", ->
			@returnedArgs.should.deep.equal [@lines, @version, @ops, @ranges]
			
		it "should have joined the doc room", (done) ->
			RealTimeClient.getConnectedClient @client.socket.sessionid, (error, client) =>
				expect(@doc_id in client.rooms).to.equal true
				done()
		
	describe "when authorised readOnly", ->
		before (done) ->
			async.series [
				(cb) =>
					FixturesManager.setUpProject {
						privilegeLevel: "readOnly"
					}, (e, {@project_id, @user_id}) =>
						cb(e)
					
				(cb) =>
					FixturesManager.setUpDoc @project_id, {@lines, @version, @ops, @ranges}, (e, {@doc_id}) =>
						cb(e)

				(cb) =>
					@client = RealTimeClient.connect()
					@client.on "connectionAccepted", cb
						
				(cb) =>
					@client.emit "joinProject", project_id: @project_id, cb
				
				(cb) =>
					@client.emit "joinDoc", @doc_id, (error, @returnedArgs...) => cb(error)
			], done

		it "should get the doc from the doc updater", ->
			MockDocUpdaterServer.getDocument
				.calledWith(@project_id, @doc_id, -1)
				.should.equal true
		
		it "should return the doc lines, version, ranges and ops", ->
			@returnedArgs.should.deep.equal [@lines, @version, @ops, @ranges]
			
		it "should have joined the doc room", (done) ->
			RealTimeClient.getConnectedClient @client.socket.sessionid, (error, client) =>
				expect(@doc_id in client.rooms).to.equal true
				done()
		
	describe "when authorised as owner", ->
		before (done) ->
			async.series [
				(cb) =>
					FixturesManager.setUpProject {
						privilegeLevel: "owner"
					}, (e, {@project_id, @user_id}) =>
						cb(e)
					
				(cb) =>
					FixturesManager.setUpDoc @project_id, {@lines, @version, @ops, @ranges}, (e, {@doc_id}) =>
						cb(e)

				(cb) =>
					@client = RealTimeClient.connect()
					@client.on "connectionAccepted", cb
						
				(cb) =>
					@client.emit "joinProject", project_id: @project_id, cb
				
				(cb) =>
					@client.emit "joinDoc", @doc_id, (error, @returnedArgs...) => cb(error)
			], done

		it "should get the doc from the doc updater", ->
			MockDocUpdaterServer.getDocument
				.calledWith(@project_id, @doc_id, -1)
				.should.equal true
		
		it "should return the doc lines, version, ranges and ops", ->
			@returnedArgs.should.deep.equal [@lines, @version, @ops, @ranges]
			
		it "should have joined the doc room", (done) ->
			RealTimeClient.getConnectedClient @client.socket.sessionid, (error, client) =>
				expect(@doc_id in client.rooms).to.equal true
				done()

	# It is impossible to write an acceptance test to test joining an unauthorized
	# project, since joinProject already catches that. If you can join a project,
	# then you can join a doc in that project.
			
	describe "with a fromVersion", ->
		before (done) ->
			@fromVersion = 36
			async.series [
				(cb) =>
					FixturesManager.setUpProject {
						privilegeLevel: "readAndWrite"
					}, (e, {@project_id, @user_id}) =>
						cb(e)
					
				(cb) =>
					FixturesManager.setUpDoc @project_id, {@lines, @version, @ops, @ranges}, (e, {@doc_id}) =>
						cb(e)

				(cb) =>
					@client = RealTimeClient.connect()
					@client.on "connectionAccepted", cb
						
				(cb) =>
					@client.emit "joinProject", project_id: @project_id, cb
				
				(cb) =>
					@client.emit "joinDoc", @doc_id, @fromVersion, (error, @returnedArgs...) => cb(error)
			], done

		it "should get the doc from the doc updater with the fromVersion", ->
			MockDocUpdaterServer.getDocument
				.calledWith(@project_id, @doc_id, @fromVersion)
				.should.equal true
		
		it "should return the doc lines, version, ranges and ops", ->
			@returnedArgs.should.deep.equal [@lines, @version, @ops, @ranges]
			
		it "should have joined the doc room", (done) ->
			RealTimeClient.getConnectedClient @client.socket.sessionid, (error, client) =>
				expect(@doc_id in client.rooms).to.equal true
				done()

	describe "with options", ->
		before (done) ->
			@options = { encodeRanges: true }
			async.series [
				(cb) =>
					FixturesManager.setUpProject {
						privilegeLevel: "readAndWrite"
					}, (e, {@project_id, @user_id}) =>
						cb(e)

				(cb) =>
					FixturesManager.setUpDoc @project_id, {@lines, @version, @ops, @ranges}, (e, {@doc_id}) =>
						cb(e)

				(cb) =>
					@client = RealTimeClient.connect()
					@client.on "connectionAccepted", cb

				(cb) =>
					@client.emit "joinProject", project_id: @project_id, cb

				(cb) =>
					@client.emit "joinDoc", @doc_id, @options, (error, @returnedArgs...) => cb(error)
			], done

		it "should get the doc from the doc updater with the default fromVersion", ->
			MockDocUpdaterServer.getDocument
				.calledWith(@project_id, @doc_id, -1)
				.should.equal true

		it "should return the doc lines, version, ranges and ops", ->
			@returnedArgs.should.deep.equal [@lines, @version, @ops, @ranges]

		it "should have joined the doc room", (done) ->
			RealTimeClient.getConnectedClient @client.socket.sessionid, (error, client) =>
				expect(@doc_id in client.rooms).to.equal true
				done()

	describe "with fromVersion and options", ->
		before (done) ->
			@fromVersion = 36
			@options = { encodeRanges: true }
			async.series [
				(cb) =>
					FixturesManager.setUpProject {
						privilegeLevel: "readAndWrite"
					}, (e, {@project_id, @user_id}) =>
						cb(e)

				(cb) =>
					FixturesManager.setUpDoc @project_id, {@lines, @version, @ops, @ranges}, (e, {@doc_id}) =>
						cb(e)

				(cb) =>
					@client = RealTimeClient.connect()
					@client.on "connectionAccepted", cb

				(cb) =>
					@client.emit "joinProject", project_id: @project_id, cb

				(cb) =>
					@client.emit "joinDoc", @doc_id, @fromVersion, @options, (error, @returnedArgs...) => cb(error)
			], done

		it "should get the doc from the doc updater with the fromVersion", ->
			MockDocUpdaterServer.getDocument
				.calledWith(@project_id, @doc_id, @fromVersion)
				.should.equal true

		it "should return the doc lines, version, ranges and ops", ->
			@returnedArgs.should.deep.equal [@lines, @version, @ops, @ranges]

		it "should have joined the doc room", (done) ->
			RealTimeClient.getConnectedClient @client.socket.sessionid, (error, client) =>
				expect(@doc_id in client.rooms).to.equal true
				done()
