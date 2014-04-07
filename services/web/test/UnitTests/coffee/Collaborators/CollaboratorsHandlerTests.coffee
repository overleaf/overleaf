should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Collaborators/CollaboratorsHandler"
expect = require("chai").expect

describe "CollaboratorsHandler", ->

	beforeEach ->

		@user =
			email:"bob@bob.com"
		@UserModel = 
			findById:sinon.stub().callsArgWith(1, null, @user)

		@settings = {}
		@CollaboratorHandler = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": log:->
			'../models/User': User:@UserModel

		@project_id = "123l2j13lkj"
		@user_id = "132kj1lk2j"

	describe "changeUsersPrivlageLevel", ->


		it "should call removeUserFromProject then addUserToProject", (done)->
			@CollaboratorHandler.removeUserFromProject = sinon.stub().callsArgWith(2)
			@CollaboratorHandler.addUserToProject = sinon.stub().callsArgWith(3)
			newPrivalageLevel = "readAndWrite"
			@CollaboratorHandler.changeUsersPrivlageLevel @project_id, @user_id, newPrivalageLevel, =>
				@CollaboratorHandler.removeUserFromProject.calledWith(@project_id, @user_id).should.equal true
				@CollaboratorHandler.addUserToProject.calledWith(@project_id, @user_id, newPrivalageLevel)
				done()


