should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Project/ProjectController"
expect = require("chai").expect

describe "ProjectController", ->

	beforeEach ->

		@project_id = "123213jlkj9kdlsaj"

		@settings = {}
		@ProjectDeleter = 
			deleteProject: sinon.stub().callsArgWith(1)
		@ProjectDuplicator =
			duplicate: sinon.stub().callsArgWith(3, null, {_id:@project_id})
		@ProjectController = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": log:->
			"./ProjectDeleter": @ProjectDeleter
			"./ProjectDuplicator": @ProjectDuplicator


		@user = 
			_id:"!£123213kjljkl"
			first_name: "bjkdsjfk"
		@projectName = "£12321jkj9ujkljds"
		@req = 
			params: 
				Project_id: @project_id
			session:
				user: @user
			body:
				projectName: @projectName 
		@res = {}

	describe "deleteProject", ->

		it "should tell the project deleter", (done)->

			@res.send = (code)=>
				@ProjectDeleter.deleteProject.calledWith(@project_id).should.equal true
				code.should.equal 200
				done()
			@ProjectController.deleteProject @req, @res


	describe "cloneProject", ->

		it "should call the project duplicator", (done)->	
			@res.send = (json)=>
				@ProjectDuplicator.duplicate.calledWith(@user, @project_id, @projectName).should.equal true
				json.project_id.should.equal @project_id
				done()
			@ProjectController.cloneProject @req, @res
