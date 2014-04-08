should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Project/ProjectController"
expect = require("chai").expect

describe "ProjectController", ->

	beforeEach ->

		@settings = {}
		@ProjectDeleter = 
			deleteProject: sinon.stub().callsArgWith(1)
		@ProjectController = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": log:->
			"./ProjectDeleter": @ProjectDeleter


		@project_id = "123213jlkj9kdlsaj"
		@req = 
			params: 
				Project_id: @project_id
		@res = {}

	describe "deleteProject", ->

		it "should tell the project deleter", (done)->

			@res.send = (code)=>
				@ProjectDeleter.deleteProject.calledWith(@project_id).should.equal true
				code.should.equal 200
				done()
			@ProjectController.deleteProject @req, @res

