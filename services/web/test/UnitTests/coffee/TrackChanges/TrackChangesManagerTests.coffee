chai = require('chai')
chai.should()
sinon = require("sinon")
modulePath = "../../../../app/js/Features/TrackChanges/TrackChangesManager"
SandboxedModule = require('sandboxed-module')

describe "TrackChangesManager", ->
	beforeEach ->
		@TrackChangesManager = SandboxedModule.require modulePath, requires:
			"request" : @request = sinon.stub()
			"settings-sharelatex": @settings =
				apis:
					trackchanges:
						url: "trackchanges.sharelatex.com"
			"logger-sharelatex": @logger = {log: sinon.stub(), error: sinon.stub()}
		@project_id = "project-id-123"
		@callback = sinon.stub()

	describe "flushProject", ->
		describe "with a successful response code", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, statusCode: 204, "")
				@TrackChangesManager.flushProject @project_id, @callback

			it "should flush the project in the track changes api", ->
				@request.post
					.calledWith("#{@settings.apis.trackchanges.url}/project/#{@project_id}/flush")
					.should.equal true

			it "should call the callback without an error", ->
				@callback.calledWith(null).should.equal true

		describe "with a failed response code", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, statusCode: 500, "")
				@TrackChangesManager.flushProject @project_id, @callback

			it "should call the callback with an error", ->
				@callback.calledWith(new Error("track-changes api responded with a non-success code: 500")).should.equal true

			it "should log the error", ->
				@logger.error
					.calledWith({
						err: new Error("track-changes api responded with a non-success code: 500")
						project_id: @project_id
					}, "error flushing project in track-changes api")
					.should.equal true

