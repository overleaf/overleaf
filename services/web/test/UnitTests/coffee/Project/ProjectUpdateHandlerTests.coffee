sinon = require('sinon')
chai = require('chai').should()
modulePath = "../../../../app/js/Features/Project/ProjectUpdateHandler.js"
SandboxedModule = require('sandboxed-module')

describe 'updating a project', ->


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
