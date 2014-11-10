chai = require('chai')
should = chai.should()
sinon = require("sinon")
modulePath = "../../../app/js/WebsocketController.js"
SandboxedModule = require('sandboxed-module')
tk = require "timekeeper"

describe 'WebsocketController', ->
	beforeEach ->
		tk.freeze(new Date())
		@project_id = "project-id-123"
		@user = {
			_id: "user-id-123"
			first_name: "James"
			last_name: "Allen"
			email: "james@example.com"
			signUpDate: new Date("2014-01-01")
			loginCount: 42
		}
		@callback = sinon.stub()
		@client =
			set: sinon.stub()
			join: sinon.stub()
		@WebsocketController = SandboxedModule.require modulePath, requires:
			"./WebApiManager": @WebApiManager = {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
	
	afterEach ->
		tk.reset()
	
	describe "joinProject", ->
		describe "when authorised", ->
			beforeEach ->
				@project = {
					name: "Test Project"
					owner: {
						_id: @owner_id = "mock-owner-id-123"
					}
				}
				@privilegeLevel = "owner"
				@WebApiManager.joinProject = sinon.stub().callsArgWith(2, null, @project, @privilegeLevel)
				@WebsocketController.joinProject @client, @user, @project_id, @callback
				
			it "should load the project from web", ->
				@WebApiManager.joinProject
					.calledWith(@project_id, @user._id)
					.should.equal true
					
			it "should set the user's id on the client", ->
				@client.set.calledWith("user_id", @user._id).should.equal true
					
			it "should set the user's email on the client", ->
				@client.set.calledWith("email", @user.email).should.equal true
					
			it "should set the user's first_name on the client", ->
				@client.set.calledWith("first_name", @user.first_name).should.equal true
				
			it "should set the user's last_name on the client", ->
				@client.set.calledWith("last_name", @user.last_name).should.equal true
					
			it "should set the user's sign up date on the client", ->
				@client.set.calledWith("signup_date", @user.signUpDate).should.equal true
					
			it "should set the user's login_count on the client", ->
				@client.set.calledWith("login_count", @user.loginCount).should.equal true
				
			it "should set the connected time on the client", ->
				@client.set.calledWith("connected_time", new Date()).should.equal true
				
			it "should set the project_id on the client", ->
				@client.set.calledWith("project_id", @project_id).should.equal true
				
			it "should set the project owner id on the client", ->
				@client.set.calledWith("owner_id", @owner_id).should.equal true
				
			it "should call the callback with the project, privilegeLevel and protocolVersion", ->
				@callback
					.calledWith(null, @project, @privilegeLevel, @WebsocketController.PROTOCOL_VERSION)
					.should.equal true
				
		describe "when not authorized", ->
			beforeEach ->
				@WebApiManager.joinProject = sinon.stub().callsArgWith(2, null, null, null)
				@WebsocketController.joinProject @client, @user, @project_id, @callback

			it "should return an error", ->
				@callback
					.calledWith(new Error("not authorized"))
					.should.equal true