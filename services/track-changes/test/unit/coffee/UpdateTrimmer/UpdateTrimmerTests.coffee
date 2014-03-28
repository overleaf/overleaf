sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/UpdateTrimmer.js"
SandboxedModule = require('sandboxed-module')
tk = require "timekeeper"

describe "UpdateTrimmer", ->
	beforeEach ->
		@now = new Date()
		tk.freeze(@now)

		@UpdateTrimmer = SandboxedModule.require modulePath, requires:
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
			"./WebApiManager": @WebApiManager = {}
			"./MongoManager": @MongoManager = {}

		@callback = sinon.stub()
		@project_id = "mock-project-id"

	afterEach ->
		tk.reset()

	describe "_shouldTrimUpdates", ->
		beforeEach ->
			@metadata = {}
			@details =
				features: {}
			@MongoManager.getProjectMetaData = sinon.stub().callsArgWith(1, null, @metadata)
			@MongoManager.setProjectMetaData = sinon.stub().callsArgWith(2)
			@WebApiManager.getProjectDetails = sinon.stub().callsArgWith(1, null, @details)

		describe "with preserveHistory set in the project meta data", ->
			beforeEach ->
				@metadata.preserveHistory = true
				@UpdateTrimmer._shouldTrimUpdates @project_id, @callback

			it "should look up the meta data", ->
				@MongoManager.getProjectMetaData
					.calledWith(@project_id)
					.should.equal true

			it "should not look up the project details", ->
				@WebApiManager.getProjectDetails
					.called
					.should.equal false

			it "should return false", ->
				@callback.calledWith(null, false).should.equal true

		describe "without preserveHistory set in the project meta data", ->
			beforeEach ->
				@metadata.preserveHistory = false

			describe "when the project has the versioning feature", ->
				beforeEach ->
					@details.features.versioning = true
					@UpdateTrimmer._shouldTrimUpdates @project_id, @callback

				it "should look up the meta data", ->
					@MongoManager.getProjectMetaData
						.calledWith(@project_id)
						.should.equal true

				it "should look up the project details", ->
					@WebApiManager.getProjectDetails
						.calledWith(@project_id)
						.should.equal true

				it "should insert preserveHistory into the metadata", ->
					@MongoManager.setProjectMetaData
						.calledWith(@project_id, {preserveHistory: true})
						.should.equal true

				it "should return false", ->
					@callback.calledWith(null, false).should.equal true

			describe "when the project does not have the versioning feature", ->
				beforeEach ->
					@details.features.versioning = false
					@UpdateTrimmer._shouldTrimUpdates @project_id, @callback

				it "should return true", ->
					@callback.calledWith(null, true).should.equal true

		describe "without any meta data", ->
			beforeEach ->
				@MongoManager.getProjectMetaData = sinon.stub().callsArgWith(1, null, null)

			describe "when the project has the versioning feature", ->
				beforeEach ->
					@details.features.versioning = true
					@UpdateTrimmer._shouldTrimUpdates @project_id, @callback

				it "should insert preserveHistory into the metadata", ->
					@MongoManager.setProjectMetaData
						.calledWith(@project_id, {preserveHistory: true})
						.should.equal true

				it "should return false", ->
					@callback.calledWith(null, false).should.equal true

			describe "when the project does not have the versioning feature", ->
				beforeEach ->
					@details.features.versioning = false
					@UpdateTrimmer._shouldTrimUpdates @project_id, @callback

				it "should return true", ->
					@callback.calledWith(null, true).should.equal true

	describe "deleteOldProjectUpdates", ->
		beforeEach ->
			@oneWeek = 7 * 24 * 60 * 60 * 1000
			@MongoManager.deleteOldProjectUpdates = sinon.stub().callsArg(2)

		describe "when the updates should be trimmed", ->
			beforeEach ->
				@UpdateTrimmer._shouldTrimUpdates = sinon.stub().callsArgWith(1, null, true)
				@UpdateTrimmer.deleteOldProjectUpdates @project_id, @callback

			it "should delete week old updates in mongo", ->
				before = Date.now() - @oneWeek
				@MongoManager.deleteOldProjectUpdates
					.calledWith(@project_id, before)
					.should.equal true

			it 'should call the callback', ->
				@callback.called.should.equal true

		describe "when the updates should not be trimmed", ->
			beforeEach ->
				@UpdateTrimmer._shouldTrimUpdates = sinon.stub().callsArgWith(1, null, false)
				@UpdateTrimmer.deleteOldProjectUpdates @project_id, @callback

			it "should not delete any updates in mongo", ->
				@MongoManager.deleteOldProjectUpdates
					.called
					.should.equal false

			it 'should call the callback', ->
				@callback.called.should.equal true
