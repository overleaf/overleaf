sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Authorization/AuthorizationManager.js"
SandboxedModule = require('sandboxed-module')
events = require "events"

describe "AuthorizationManager", ->
	beforeEach ->
		@SocketManager = {}
		@AuthorizationManager = SandboxedModule.require modulePath, requires:
			"../WebApi/WebApiManager": @WebApiManager = {}
			"../Sockets/SocketManager": @SocketManager
		@callback = sinon.stub()
		@user_id = "user-id-123"
		@project_id = "project-id-456"
		@auth_token = "auth-token-789"
		@client =
			params: {}
			get: (key, callback = (error, value) ->) ->
				callback null, @params[key]

	describe "canClientJoinProjectRoom", ->
		beforeEach ->
			@client.params.auth_token = @auth_token
			@client.params.id = @user_id
			
		describe "when the client is a collaborator", ->
			beforeEach ->
				@collaborators = [
					id: @user_id
				]
				@WebApiManager.getProjectCollaborators = sinon.stub().callsArgWith(2, null, @collaborators)
				@AuthorizationManager.canClientJoinProjectRoom(@client, @project_id, @callback)

			it "should get the list of collaborators from the web api", ->
				@WebApiManager.getProjectCollaborators
					.calledWith(@project_id, @auth_token)
					.should.equal true

			it "should return true", ->
				@callback.calledWith(null, true).should.equal true

		describe "when the client is not a collaborator", ->
			beforeEach ->
				@collaborators = [
					id: "not the user id"
				]
				@WebApiManager.getProjectCollaborators = sinon.stub().callsArgWith(2, null, @collaborators)
				@AuthorizationManager.canClientJoinProjectRoom(@client, @project_id, @callback)

			it "should return false", ->
				@callback.calledWith(null, false).should.equal true

