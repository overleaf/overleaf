chai = require("chai")
expect = chai.expect
chai.should()

RealTimeClient = require "./helpers/RealTimeClient"
MockDocUpdaterServer = require "./helpers/MockDocUpdaterServer"
FixturesManager = require "./helpers/FixturesManager"

describe "joinDoc", ->
	before ->
		@lines = ["test", "doc", "lines"]
		@version = 42
		@ops = ["mock", "doc", "ops"]
			
	describe "when authorised readAndWrite", ->
		before (done) ->
			FixturesManager.setUpProject {
				privilegeLevel: "readAndWrite"
			}, (error, data) =>
				throw error if error?
				{@project_id, @user_id} = data
				FixturesManager.setUpDoc @project_id, {@lines, @version, @ops}, (error, data) =>
					throw error if error?
					{@doc_id} = data
					@client = RealTimeClient.connect()
					@client.emit "joinProject", project_id: @project_id, (error) =>
						throw error if error?
						@client.emit "joinDoc", @doc_id, (error, @returnedArgs...) =>
							throw error if error?
							done()

		it "should get the doc from the doc updater", ->
			MockDocUpdaterServer.getDocument
				.calledWith(@project_id, @doc_id, -1)
				.should.equal true
		
		it "should return the doc lines, version and ops", ->
			@returnedArgs.should.deep.equal [@lines, @version, @ops]
			
		it "should have joined the doc room", (done) ->
			RealTimeClient.getConnectedClient @client.socket.sessionid, (error, client) =>
				expect(@doc_id in client.rooms).to.equal true
				done()
		
	describe "when authorised readOnly", ->
		before (done) ->
			FixturesManager.setUpProject {
				privilegeLevel: "readOnly"
			}, (error, data) =>
				throw error if error?
				{@project_id, @user_id} = data
				FixturesManager.setUpDoc @project_id, {@lines, @version, @ops}, (error, data) =>
					throw error if error?
					{@doc_id} = data
					@client = RealTimeClient.connect()
					@client.emit "joinProject", project_id: @project_id, (error) =>
						throw error if error?
						@client.emit "joinDoc", @doc_id, (error, @returnedArgs...) =>
							throw error if error?
							done()

		it "should get the doc from the doc updater", ->
			MockDocUpdaterServer.getDocument
				.calledWith(@project_id, @doc_id, -1)
				.should.equal true
		
		it "should return the doc lines, version and ops", ->
			@returnedArgs.should.deep.equal [@lines, @version, @ops]
			
		it "should have joined the doc room", (done) ->
			RealTimeClient.getConnectedClient @client.socket.sessionid, (error, client) =>
				expect(@doc_id in client.rooms).to.equal true
				done()
		
	describe "when authorised as owner", ->
		before (done) ->
			FixturesManager.setUpProject {
				privilegeLevel: "owner"
			}, (error, data) =>
				throw error if error?
				{@project_id, @user_id} = data
				FixturesManager.setUpDoc @project_id, {@lines, @version, @ops}, (error, data) =>
					throw error if error?
					{@doc_id} = data
					@client = RealTimeClient.connect()
					@client.emit "joinProject", project_id: @project_id, (error) =>
						throw error if error?
						@client.emit "joinDoc", @doc_id, (error, @returnedArgs...) =>
							throw error if error?
							done()

		it "should get the doc from the doc updater", ->
			MockDocUpdaterServer.getDocument
				.calledWith(@project_id, @doc_id, -1)
				.should.equal true
		
		it "should return the doc lines, version and ops", ->
			@returnedArgs.should.deep.equal [@lines, @version, @ops]
			
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
			FixturesManager.setUpProject {
				privilegeLevel: "readAndWrite"
			}, (error, data) =>
				throw error if error?
				{@project_id, @user_id} = data
				FixturesManager.setUpDoc @project_id, {@lines, @version, @ops}, (error, data) =>
					throw error if error?
					{@doc_id} = data
					@client = RealTimeClient.connect()
					@client.emit "joinProject", project_id: @project_id, (error) =>
						throw error if error?
						@client.emit "joinDoc", @doc_id, @fromVersion, (error, @returnedArgs...) =>
							throw error if error?
							done()

		it "should get the doc from the doc updater with the fromVersion", ->
			MockDocUpdaterServer.getDocument
				.calledWith(@project_id, @doc_id, @fromVersion)
				.should.equal true
		
		it "should return the doc lines, version and ops", ->
			@returnedArgs.should.deep.equal [@lines, @version, @ops]
			
		it "should have joined the doc room", (done) ->
			RealTimeClient.getConnectedClient @client.socket.sessionid, (error, client) =>
				expect(@doc_id in client.rooms).to.equal true
				done()