sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Collaborators/CollaboratorsController.js"
SandboxedModule = require('sandboxed-module')
events = require "events"
MockRequest = require "../helpers/MockRequest"
MockResponse = require "../helpers/MockResponse"
ObjectId = require("mongojs").ObjectId

describe "CollaboratorsController", ->
	beforeEach ->
		@CollaboratorsHandler =
			removeUserFromProject:sinon.stub()
		@CollaboratorsController = SandboxedModule.require modulePath, requires:
			"../Project/ProjectGetter": @ProjectGetter = {}
			"./CollaboratorsHandler": @CollaboratorsHandler
			"../Editor/EditorController": @EditorController = {}
		@res = new MockResponse()
		@req = new MockRequest()

		@callback = sinon.stub()

	describe "getCollaborators", ->
		beforeEach ->
			@project =
				_id: @project_id = "project-id-123"
			@collaborators = ["array of collaborators"]
			@req.params = Project_id: @project_id
			@ProjectGetter.getProject = sinon.stub().callsArgWith(2, null, @project)
			@ProjectGetter.populateProjectWithUsers = sinon.stub().callsArgWith(1, null, @project)
			@CollaboratorsController._formatCollaborators = sinon.stub().callsArgWith(1, null, @collaborators)
			@CollaboratorsController.getCollaborators(@req, @res)

		it "should get the project", ->
			@ProjectGetter.getProject
				.calledWith(@project_id, { owner_ref: true, collaberator_refs: true, readOnly_refs: true })
				.should.equal true

		it "should populate the users in the project", ->
			@ProjectGetter.populateProjectWithUsers
				.calledWith(@project)
				.should.equal true

		it "should format the collaborators", ->
			@CollaboratorsController._formatCollaborators
				.calledWith(@project)
				.should.equal true

		it "should return the formatted collaborators", ->
			@res.body.should.equal JSON.stringify(@collaborators)

	describe "removeSelfFromProject", ->
		beforeEach ->
			@req.session =
				user: _id: @user_id = "user-id-123"
				destroy:->
			@req.params = project_id: @project_id
			@CollaboratorsHandler.removeUserFromProject = sinon.stub().callsArg(2)

			@CollaboratorsController.removeSelfFromProject(@req, @res)

		it "should remove the logged in user from the project", ->
			@CollaboratorsHandler.removeUserFromProject.calledWith(@project_id, @user_id)

		it "should return a success code", ->
			@res.statusCode.should.equal 204
			
	describe "addUserToProject", ->
		beforeEach ->
			@req.params =
				Project_id: @project_id = "project-id-123"
			@req.body =
				email: @email = "joe@example.com"
				privileges: @privileges = "readAndWrite"
			@res.json = sinon.stub()
			@EditorController.addUserToProject = sinon.stub().callsArgWith(3, null, @user = {"mock": "user"})
			@CollaboratorsController.addUserToProject @req, @res
			
		it "should add the user to the project", ->
			@EditorController.addUserToProject
				.calledWith(@project_id, @email, @privileges)
				.should.equal true
				
		it "should send the back the added user", ->
			@res.json.calledWith(user: @user).should.equal true
			
	describe "removeUserFromProject", ->
		beforeEach ->
			@req.params =
				Project_id: @project_id = "project-id-123"
				user_id: @user_id = "user-id-123"
			@res.sendStatus = sinon.stub()
			@EditorController.removeUserFromProject = sinon.stub().callsArg(2)
			@CollaboratorsController.removeUserFromProject @req, @res
			
		it "should from the user from the project", ->
			@EditorController.removeUserFromProject
				.calledWith(@project_id, @user_id)
				.should.equal true
				
		it "should send the back a success response", ->
			@res.sendStatus.calledWith(204).should.equal true


	describe "_formatCollaborators", ->
		beforeEach ->
			@owner =
				_id: ObjectId()
				first_name: "Lenny"
				last_name: "Lion"
				email: "test@sharelatex.com"
				hashed_password: "password" # should not be included

		describe "formatting the owner", ->
			beforeEach ->
				@project =
					owner_ref: @owner
					collaberator_refs: []
				@CollaboratorsController._formatCollaborators(@project, @callback)

			it "should return the owner with read, write and admin permissions", ->
				@formattedOwner = @callback.args[0][1][0]
				expect(@formattedOwner).to.deep.equal {
					id: @owner._id.toString()
					first_name: @owner.first_name
					last_name: @owner.last_name
					email: @owner.email
					permissions: ["read", "write", "admin"]
					owner: true
				}

		describe "formatting a collaborator with write access", ->
			beforeEach ->
				@collaborator =
					_id: ObjectId()
					first_name: "Douglas"
					last_name: "Adams"
					email: "doug@sharelatex.com"
					hashed_password: "password" # should not be included
					
				@project =
					owner_ref: @owner
					collaberator_refs: [ @collaborator ]
				@CollaboratorsController._formatCollaborators(@project, @callback)

			it "should return the collaborator with read and write permissions", ->
				@formattedCollaborator = @callback.args[0][1][1]
				expect(@formattedCollaborator).to.deep.equal {
					id: @collaborator._id.toString()
					first_name: @collaborator.first_name
					last_name: @collaborator.last_name
					email: @collaborator.email
					permissions: ["read", "write"]
					owner: false
				}

		describe "formatting a collaborator with read only access", ->
			beforeEach ->
				@collaborator =
					_id: ObjectId()
					first_name: "Douglas"
					last_name: "Adams"
					email: "doug@sharelatex.com"
					hashed_password: "password" # should not be included
					
				@project =
					owner_ref: @owner
					collaberator_refs: []
					readOnly_refs: [ @collaborator ]
				@CollaboratorsController._formatCollaborators(@project, @callback)

			it "should return the collaborator with read permissions", ->
				@formattedCollaborator = @callback.args[0][1][1]
				expect(@formattedCollaborator).to.deep.equal {
					id: @collaborator._id.toString()
					first_name: @collaborator.first_name
					last_name: @collaborator.last_name
					email: @collaborator.email
					permissions: ["read"]
					owner: false
				}
					
			

		
				
