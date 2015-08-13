sinon = require('sinon')
chai = require('chai').should()
modulePath = "../../../../app/js/Features/Project/ProjectUpdateHandler.js"
SandboxedModule = require('sandboxed-module')

describe 'ProjectUpdateHandler', ->


	beforeEach ->
		@ProjectModel = class Project
		@ProjectModel.update = sinon.stub().callsArg(3)
		@handler = SandboxedModule.require modulePath, requires:
			'../../models/Project':{Project:@ProjectModel}

	describe 'marking a project as recently updated', ->
		it 'should send an update to mongo', (done)->
			project_id = "project_id"
			@handler.markAsUpdated project_id, (err)=>
				args = @ProjectModel.update.args[0]
				args[0]._id.should.equal project_id
				date = args[1].lastUpdated+""
				now = Date.now()+""
				date.substring(0,5).should.equal now.substring(0,5)
				done()

	describe "markAsOpened", ->

		it 'should send an update to mongo', (done)->
			project_id = "project_id"
			@handler.markAsOpened project_id, (err)=>
				args = @ProjectModel.update.args[0]
				args[0]._id.should.equal project_id
				date = args[1].lastOpened+""
				now = Date.now()+""
				date.substring(0,5).should.equal now.substring(0,5)
				done()

	describe "markAsInactive", ->

		it 'should send an update to mongo', (done)->
			project_id = "project_id"
			@handler.markAsInactive project_id, (err)=>
				args = @ProjectModel.update.args[0]
				args[0]._id.should.equal project_id
				args[1].inactive.should.equal true
				done()

	describe "markAsActive", ->
		it 'should send an update to mongo', (done)->
			project_id = "project_id"
			@handler.markAsActive project_id, (err)=>
				args = @ProjectModel.update.args[0]
				args[0]._id.should.equal project_id
				args[1]["$unset"].inactive.should.equal true
				done()


