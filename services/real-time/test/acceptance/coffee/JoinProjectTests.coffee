chai = require("chai")
expect = chai.expect
chai.should()

RealTimeClient = require "./helpers/RealTimeClient"
MockWebClient = require "./helpers/MockWebClient"

describe "joinProject", ->
	describe "when authorized", ->
		before (done) ->
			@user_id    = "mock-user-id"
			@project_id = "mock-project-id"
			privileges = {}
			privileges[@user_id] = "owner"
			MockWebClient.createMockProject(@project_id, privileges, {
				name: "Test Project"
			})
			MockWebClient.run (error) =>
				throw error if error?
				RealTimeClient.setSession {
					user: { _id: @user_id }
				}, (error) =>
					throw error if error?
					@client = RealTimeClient.connect()
					@client.emit "joinProject", {
						project_id: @project_id
					}, (error, @project, @privilegeLevel, @protocolVersion) =>
						throw error if error?
						done()
					
		it "should get the project from web", ->
			MockWebClient.joinProject
				.calledWith(@project_id, @user_id)
				.should.equal true
					
		it "should return the project", ->
			@project.should.deep.equal {
				name: "Test Project"
			}
		
		it "should return the privilege level", ->
			@privilegeLevel.should.equal "owner"
		
		it "should return the protocolVersion", ->
			@protocolVersion.should.equal 2
			
	describe "when not authorized", ->
		before (done) ->
			@user_id    = "mock-user-id-2"
			@project_id = "mock-project-id-2"
			privileges = {}
			MockWebClient.createMockProject(@project_id, privileges, {
				name: "Test Project"
			})
			MockWebClient.run (error) =>
				throw error if error?
				RealTimeClient.setSession {
					user: { _id: @user_id }
				}, (error) =>
					throw error if error?
					@client = RealTimeClient.connect()
					@client.emit "joinProject", {
						project_id: @project_id
					}, (@error, @project, @privilegeLevel, @protocolVersion) =>
						done()
		
		it "should return an error", ->
			@error.message.should.equal "not authorized"
