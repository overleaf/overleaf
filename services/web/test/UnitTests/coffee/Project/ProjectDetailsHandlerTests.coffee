should = require('chai').should()
modulePath = "../../../../app/js/Features/Project/ProjectDetailsHandler"
Errors = require "../../../../app/js/Features/Errors/Errors"
SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
assert = require("chai").assert
expect = require("chai").expect
require('chai').should()

describe 'ProjectDetailsHandler', ->

	beforeEach ->
		@project_id = "321l3j1kjkjl"
		@user_id = "user-id-123"
		@project =
			name: "project"
			description: "this is a great project"
			something:"should not exist"
			compiler: "latexxxxxx"
			owner_ref: @user_id
		@user =
			features: "mock-features"
		@ProjectGetter =
			getProjectWithoutDocLines: sinon.stub().callsArgWith(1, null, @project)
			getProject: sinon.stub().callsArgWith(2, null, @project)
		@ProjectModel =
			update: sinon.stub()
			findOne: sinon.stub()
		@UserGetter =
			getUser: sinon.stub().callsArgWith(1, null, @user)
		@tpdsUpdateSender =
			moveEntity:sinon.stub().callsArgWith 1
		@handler = SandboxedModule.require modulePath, requires:
			"./ProjectGetter":@ProjectGetter
			'../../models/Project': Project:@ProjectModel
			"../User/UserGetter": @UserGetter
			'../ThirdPartyDataStore/TpdsUpdateSender':@tpdsUpdateSender
			'logger-sharelatex':
				log:->
				err:->

	describe "getDetails", ->

		it "should find the project and owner", (done)->
			@handler.getDetails @project_id, (err, details)=>
				details.name.should.equal @project.name
				details.description.should.equal @project.description
				details.compiler.should.equal @project.compiler
				details.features.should.equal @user.features
				assert.equal(details.something, undefined)
				done()

		it "should find overleaf metadata if it exists", (done)->
			@project.overleaf = { id: 'id' }
			@handler.getDetails @project_id, (err, details)=>
				details.overleaf.should.equal @project.overleaf
				assert.equal(details.something, undefined)
				done()

		it "should return an error for a non-existent project", (done)->
			@ProjectGetter.getProject.callsArg(2, null, null)
			err = new Errors.NotFoundError("project not found")
			@handler.getDetails "0123456789012345678901234", (error, details) =>
				err.should.eql error
				done()

		it "should return the error", (done)->
			error = "some error"
			@ProjectGetter.getProject.callsArgWith(2, error)
			@handler.getDetails @project_id, (err)=>
				err.should.equal error
				done()

	describe "getProjectDescription", ->

		it "should make a call to mongo just for the description", (done)->
			@ProjectModel.findOne.callsArgWith(2)
			@handler.getProjectDescription @project_id, (err, description)=>
				@ProjectModel.findOne.calledWith({_id:@project_id}, "description").should.equal true
				done()

		it "should return what the mongo call returns", (done)->
			err = "error"
			description = "cool project"
			@ProjectModel.findOne.callsArgWith(2, err, {description:description})
			@handler.getProjectDescription @project_id, (returnedErr, returnedDescription)=>
				err.should.equal returnedErr
				description.should.equal returnedDescription
				done()

	describe "setProjectDescription", ->

		beforeEach ->
			@description = "updated teh description"

		it "should update the project detials", (done)->
			@ProjectModel.update.callsArgWith(2)
			@handler.setProjectDescription @project_id, @description, =>
				@ProjectModel.update.calledWith({_id:@project_id}, {description:@description}).should.equal true
				done()



	describe "renameProject", ->
		beforeEach ->
			@handler.validateProjectName = sinon.stub().yields()
			@ProjectModel.update.callsArgWith(2)
			@newName = "new name here"

		it "should update the project with the new name", (done)->
			newName = "new name here"
			@handler.renameProject @project_id, @newName, =>
				@ProjectModel.update.calledWith({_id: @project_id}, {name: @newName}).should.equal true
				done()

		it "should tell the tpdsUpdateSender", (done)->
			@handler.renameProject @project_id, @newName, =>
				@tpdsUpdateSender.moveEntity.calledWith({project_id:@project_id, project_name:@project.name, newProjectName:@newName}).should.equal true
				done()

		it "should not do anything with an invalid name", (done) ->
			@handler.validateProjectName = sinon.stub().yields(new Error("invalid name"))
			@handler.renameProject @project_id, @newName, =>
				@tpdsUpdateSender.moveEntity.called.should.equal false
				@ProjectModel.update.called.should.equal false
				done()

	describe "validateProjectName", ->

		it "should reject undefined names", (done) ->
			@handler.validateProjectName undefined, (error) ->
				expect(error).to.exist
				done()

		it "should reject empty names", (done) ->
			@handler.validateProjectName "", (error) ->
				expect(error).to.exist
				done()

		it "should reject empty names with /s", (done) ->
			@handler.validateProjectName "foo/bar", (error) ->
				expect(error).to.exist
				done()

		it "should reject long names", (done) ->
			@handler.validateProjectName new Array(1000).join("a"), (error) ->
				expect(error).to.exist
				done()

		it "should accept normal names", (done) ->
			@handler.validateProjectName "foobar", (error) ->
				expect(error).to.not.exist
				done()

	describe "setPublicAccessLevel", ->
		beforeEach ->
			@ProjectModel.update.callsArgWith(2)
			@accessLevel = "readOnly"

		it "should update the project with the new level", (done)->
			@handler.setPublicAccessLevel @project_id, @accessLevel, =>
				@ProjectModel.update.calledWith({_id: @project_id}, {publicAccesLevel: @accessLevel}).should.equal true
				done()

