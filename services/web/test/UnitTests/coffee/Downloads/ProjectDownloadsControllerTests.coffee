sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Downloads/ProjectDownloadsController.js"
SandboxedModule = require('sandboxed-module')
MockRequest = require "../helpers/MockRequest"
MockResponse = require "../helpers/MockResponse"

describe "ProjectDownloadsController", ->
	beforeEach ->
		@project_id = "project-id-123"
		@req = new MockRequest()
		@res = new MockResponse()
		@next = sinon.stub()
		@DocumentUpdaterHandler = sinon.stub()
		@ProjectDownloadsController = SandboxedModule.require modulePath, requires:
			"./ProjectZipStreamManager"   : @ProjectZipStreamManager = {}
			"../../models/Project"        : Project: @Project = {}
			"../../infrastructure/Metrics": @metrics = {}
			"logger-sharelatex"           : @logger = {log: sinon.stub()}
			"../DocumentUpdater/DocumentUpdaterHandler": @DocumentUpdaterHandler

	describe "downloadProject", ->
		beforeEach ->
			@stream =
				pipe: sinon.stub()
			@ProjectZipStreamManager.createZipStreamForProject =
				sinon.stub().callsArgWith(1, null, @stream)
			@req.params = Project_id: @project_id
			@res.contentType = sinon.stub()
			@res.header = sinon.stub()
			@project_name = "project name with accênts"
			@Project.findById = sinon.stub().callsArgWith(2, null, name: @project_name)
			@DocumentUpdaterHandler.flushProjectToMongo = sinon.stub().callsArgWith(1)
			@metrics.inc = sinon.stub()
			@ProjectDownloadsController.downloadProject @req, @res, @next

		it "should create a zip from the project", ->
			@ProjectZipStreamManager.createZipStreamForProject
				.calledWith(@project_id)
				.should.equal true

		it "should stream the zip to the request", ->
			@stream.pipe.calledWith(@res)
				.should.equal true

		it "should set the correct content type on the request", ->
			@res.contentType
				.calledWith("application/zip")
				.should.equal true

		it "should flush the project to mongo", ->
			@DocumentUpdaterHandler.flushProjectToMongo
				.calledWith(@project_id)
				.should.equal true

		it "should look up the project's name", ->
			@Project.findById.calledWith(@project_id, "name").should.equal(true)

		it "should name the downloaded file after the project", ->
			@res.header
				.calledWith(
					"Content-Disposition",
					"attachment; filename=#{encodeURIComponent(@project_name)}.zip")
				.should.equal true

		it "should record the action via Metrics", ->
			@metrics.inc.calledWith("zip-downloads").should.equal true

		it "should log the action", ->
			@logger.log
				.calledWith(sinon.match.any, "downloading project")
				.should.equal true

