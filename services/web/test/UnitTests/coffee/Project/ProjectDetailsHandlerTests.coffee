should = require('chai').should()
modulePath = "../../../../app/js/Features/Project/ProjectDetailsHandler"
SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
assert = require("chai").assert
require('chai').should()

describe 'Project details handler', ->

	beforeEach ->
		@ProjectGetter = 
			getProjectWithoutDocLines: sinon.stub()
		@ProjectModel =
			update: sinon.stub()
		@handler = SandboxedModule.require modulePath, requires:
			"./ProjectGetter":@ProjectGetter
			'../../models/Project': Project:@ProjectModel
			'logger-sharelatex':
				log:->
				err:->
		@project_id = "321l3j1kjkjl"
		@project = 
			name: "project"
			description: "this is a great project"
			something:"should not exist"
			compiler: "latexxxxxx"


	describe "getDetails", ->

		it "should find the project", (done)->
			@ProjectGetter.getProjectWithoutDocLines.callsArgWith(1, null, @project)
			@handler.getDetails @project_id, (err, details)=>
				details.name.should.equal @project.name
				details.description.should.equal @project.description
				details.compiler.should.equal @project.compiler
				assert.equal(details.something, undefined)
				done()


		it "should return the error", (done)->
			error = "some error"
			@ProjectGetter.getProjectWithoutDocLines.callsArgWith(1, error)
			@handler.getDetails @project_id, (err)=>
				err.should.equal error
				done()

	describe "setProjectDescription", ->

		beforeEach ->
			@description = "updated teh description"

		it "should update the project detials", (done)->
			@ProjectModel.update.callsArgWith(2)
			@handler.setProjectDescription @project_id, @description, =>
				@ProjectModel.update.calledWith({_id:@project_id}, {description:@description}).should.equal true
				done()


