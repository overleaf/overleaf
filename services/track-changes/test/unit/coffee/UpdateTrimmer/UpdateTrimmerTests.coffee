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

	describe "shouldTrimUpdates", ->
		beforeEach ->
			@metadata = {}
			@details =
				features: {}
			@MongoManager.getProjectMetaData = sinon.stub().callsArgWith(1, null, @metadata)
			@MongoManager.setProjectMetaData = sinon.stub().callsArgWith(2)
			@MongoManager.upgradeHistory = sinon.stub().callsArgWith(1)
			@WebApiManager.getProjectDetails = sinon.stub().callsArgWith(1, null, @details)

		describe "with preserveHistory set in the project meta data", ->
			beforeEach ->
				@metadata.preserveHistory = true
				@UpdateTrimmer.shouldTrimUpdates @project_id, @callback

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
					@UpdateTrimmer.shouldTrimUpdates @project_id, @callback

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

				it "should upgrade any existing history", ->
					@MongoManager.upgradeHistory
						.calledWith(@project_id)
						.should.equal true

				it "should return false", ->
					@callback.calledWith(null, false).should.equal true

			describe "when the project does not have the versioning feature", ->
				beforeEach ->
					@details.features.versioning = false
					@UpdateTrimmer.shouldTrimUpdates @project_id, @callback

				it "should return true", ->
					@callback.calledWith(null, true).should.equal true

		describe "without any meta data", ->
			beforeEach ->
				@MongoManager.getProjectMetaData = sinon.stub().callsArgWith(1, null, null)

			describe "when the project has the versioning feature", ->
				beforeEach ->
					@details.features.versioning = true
					@UpdateTrimmer.shouldTrimUpdates @project_id, @callback

				it "should insert preserveHistory into the metadata", ->
					@MongoManager.setProjectMetaData
						.calledWith(@project_id, {preserveHistory: true})
						.should.equal true

				it "should upgrade any existing history", ->
					@MongoManager.upgradeHistory
						.calledWith(@project_id)
						.should.equal true

				it "should return false", ->
					@callback.calledWith(null, false).should.equal true

			describe "when the project does not have the versioning feature", ->
				beforeEach ->
					@details.features.versioning = false
					@UpdateTrimmer.shouldTrimUpdates @project_id, @callback

				it "should return true", ->
					@callback.calledWith(null, true).should.equal true

