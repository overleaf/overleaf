sinon = require('sinon')
chai = require('chai').should()
modulePath = "../../../../app/js/Features/Project/ProjectUpdateHandler.js"
SandboxedModule = require('sandboxed-module')

describe 'ProjectUpdateHandler', ->


	before ->
		@fakeTime = new Date()
		@clock = sinon.useFakeTimers(@fakeTime.getTime())

	beforeEach ->
		@ProjectModel = class Project
		@ProjectModel.update = sinon.stub().callsArg(3)
		@handler = SandboxedModule.require modulePath, requires:
			'../../models/Project':{Project:@ProjectModel}
			'logger-sharelatex' : { log: sinon.stub() }

	after ->
		@clock.restore()

	describe 'marking a project as recently updated', ->
		beforeEach ->
			@project_id = "project_id"
			@lastUpdatedAt = 987654321
			@lastUpdatedBy = 'fake-last-updater-id'

		it 'should send an update to mongo', (done)->
			@handler.markAsUpdated @project_id, @lastUpdatedAt, @lastUpdatedBy, (err) =>
				sinon.assert.calledWith(
					@ProjectModel.update,
					{
						_id: @project_id,
						lastUpdated: { $lt: @lastUpdatedAt }
					},
					{
						lastUpdated: @lastUpdatedAt,
						lastUpdatedBy: @lastUpdatedBy
					}
				)
				done()

		it 'should set smart fallbacks', (done)->
			@handler.markAsUpdated @project_id, null, null, (err) =>
				sinon.assert.calledWithMatch(
					@ProjectModel.update,
					{
						_id: @project_id,
						lastUpdated: { $lt: @fakeTime }
					},
					{
						lastUpdated: @fakeTime
						lastUpdatedBy: null
					}
				)
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
				args[1].active.should.equal false
				done()

	describe "markAsActive", ->
		it 'should send an update to mongo', (done)->
			project_id = "project_id"
			@handler.markAsActive project_id, (err)=>
				args = @ProjectModel.update.args[0]
				args[0]._id.should.equal project_id
				args[1].active.should.equal true
				done()


