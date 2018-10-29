chai = require('chai')
assert = require('chai').assert
should = chai.should()
expect = chai.expect
sinon = require 'sinon'
modulePath = "../../../../app/js/Features/Project/ProjectHistoryHandler"
SandboxedModule = require('sandboxed-module')
ObjectId = require("mongoose").Types.ObjectId

describe 'ProjectHistoryHandler', ->
	project_id = '4eecb1c1bffa66588e0000a1'
	userId = 1234

	beforeEach ->
		@ProjectModel = class Project
			constructor:(options)->
				@._id = project_id
				@name = "project_name_here"
				@rev = 0
			rootFolder:[@rootFolder]
		@project = new @ProjectModel()

		@callback = sinon.stub()

		@ProjectHistoryHandler = SandboxedModule.require modulePath, requires:
			'logger-sharelatex': @logger = {log:sinon.stub(), error: sinon.stub(), err:->}
			'settings-sharelatex': @Settings = {}
			'../../models/Project': Project:@ProjectModel
			'./ProjectDetailsHandler': @ProjectDetailsHandler = {}
			'../History/HistoryManager': @HistoryManager = {}
			'./ProjectEntityUpdateHandler': @ProjectEntityUpdateHandler = {}

	describe "starting history for an existing project", ->
		beforeEach ->
			@newHistoryId = 123456789
			@HistoryManager.initializeProject = sinon.stub().callsArgWith(0, null, {overleaf_id: @newHistoryId})
			@HistoryManager.flushProject = sinon.stub().callsArg(1)
			@ProjectEntityUpdateHandler.resyncProjectHistory = sinon.stub().callsArg(1)

		describe "when the history does not already exist", ->
			beforeEach ->
				@ProjectDetailsHandler.getDetails = sinon.stub().withArgs(project_id).callsArgWith(1, null, @project)
				@ProjectModel.update = sinon.stub().callsArgWith(2,null,{n:1})
				@ProjectHistoryHandler.ensureHistoryExistsForProject project_id, @callback

			it "should get any existing history id for the project", ->
				@ProjectDetailsHandler.getDetails
					.calledWith(project_id)
					.should.equal true

			it "should initialize a new history in the v1 history service", ->
				@HistoryManager.initializeProject
					.called.should.equal.true
			
			it "should set the new history id on the project", ->
				@ProjectModel.update
					.calledWith({_id: project_id, "overleaf.history.id": {$exists:false}}, {"overleaf.history.id":@newHistoryId})
					.should.equal true

			it "should resync the project history", ->
				@ProjectEntityUpdateHandler.resyncProjectHistory
					.calledWith(project_id)
					.should.equal true

			it "should flush the project history", ->
				@HistoryManager.flushProject
					.calledWith(project_id)
					.should.equal true
			
			it "should call the callback without an error", ->
				@callback.called.should.equal true

		describe "when the history already exists", ->
			beforeEach ->
				@project.overleaf = {history: {id: 1234}}
				@ProjectDetailsHandler.getDetails = sinon.stub().withArgs(project_id).callsArgWith(1, null, @project)
				@ProjectModel.update = sinon.stub()
				@ProjectHistoryHandler.ensureHistoryExistsForProject project_id, @callback

			it "should get any existing history id for the project", ->
				@ProjectDetailsHandler.getDetails
					.calledWith(project_id)
					.should.equal true

			it "should not initialize a new history in the v1 history service", ->
				@HistoryManager.initializeProject
					.called.should.equal false
			
			it "should not set the new history id on the project", ->
				@ProjectModel.update
					.called
					.should.equal false

			it "should not resync the project history", ->
				@ProjectEntityUpdateHandler.resyncProjectHistory
					.called
					.should.equal false

			it "should not flush the project history", ->
				@HistoryManager.flushProject
					.called
					.should.equal false
			
			it "should call the callback", ->
				@callback.calledWith().should.equal true