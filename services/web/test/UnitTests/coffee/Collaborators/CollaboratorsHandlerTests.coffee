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
			update: sinon.stub()

		@settings = {}
		@ProjectModel = 
			update: sinon.stub().callsArgWith(1)
		@CollaboratorHandler = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": 
				log:->
				err:->
			'../../models/User': User:@UserModel
			"../../models/Project": Project:@ProjectModel
			"../Email/EmailHandler": {}

		@project_id = "123l2j13lkj"
		@user_id = "132kj1lk2j"

	describe "changeUsersPrivilegeLevel", ->


		it "should call removeUserFromProject then addUserToProject", (done)->
			@CollaboratorHandler.removeUserFromProject = sinon.stub().callsArgWith(2)
			@CollaboratorHandler.addUserToProject = sinon.stub().callsArgWith(3)
			newPrivalageLevel = "readAndWrite"
			@CollaboratorHandler.changeUsersPrivilegeLevel @project_id, @user_id, newPrivalageLevel, =>
				@CollaboratorHandler.removeUserFromProject.calledWith(@project_id, @user_id).should.equal true
				@CollaboratorHandler.addUserToProject.calledWith(@project_id, @user_id, newPrivalageLevel)
				done()


	describe "removeUserFromProject", ->

		beforeEach ->
			@ProjectModel.update.callsArgWith(2)

		it "should remove the user from mongo", (done)->

			@CollaboratorHandler.removeUserFromProject @project_id, @user_id, =>
				update = @ProjectModel.update.args[0][1]
				assert.deepEqual update, "$pull":{collaberator_refs:@user_id, readOnly_refs:@user_id}
				done()





