sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Uploads/ProjectUploadController.js"
SandboxedModule = require('sandboxed-module')
MockRequest = require "../helpers/MockRequest"
MockResponse = require "../helpers/MockResponse"

describe "ProjectUploadController", ->
	beforeEach ->
		@req = new MockRequest()
		@res = new MockResponse()
		@user_id = "user-id-123"
		@metrics =
			Timer: class Timer
				done: sinon.stub()
		@ProjectUploadController = SandboxedModule.require modulePath, requires:
			"./ProjectUploadManager" : @ProjectUploadManager = {}
			"./FileSystemImportManager" : @FileSystemImportManager = {}
			"logger-sharelatex" : @logger = {log: sinon.stub(), error: sinon.stub()}
			"../../infrastructure/Metrics": @metrics
			"fs" : @fs = {}
		
	describe "uploadProject", ->
		beforeEach ->
			@path = "/path/to/file/on/disk.zip"
			@name = "filename.zip"
			@req.files =
				qqfile:
					path: @path
					name: @name
			@req.session =
				user:
					_id: @user_id
			@project =
				_id: @project_id = "project-id-123"

			@fs.unlink = sinon.stub()

		describe "successfully", ->
			beforeEach ->
				@ProjectUploadManager.createProjectFromZipArchive =
					sinon.stub().callsArgWith(3, null, @project)
				@ProjectUploadController.uploadProject @req, @res

			it "should create a project owned by the logged in user", ->
				@ProjectUploadManager
					.createProjectFromZipArchive
					.calledWith(@user_id)
					.should.equal true

			it "should create a project with the same name as the zip archive", ->
				@ProjectUploadManager
					.createProjectFromZipArchive
					.calledWith(sinon.match.any, "filename", sinon.match.any)
					.should.equal true
				
			it "should create a project from the zip archive", ->
				@ProjectUploadManager
					.createProjectFromZipArchive
					.calledWith(sinon.match.any, sinon.match.any, @path)
					.should.equal true
				
			it "should return a successful response to the FileUploader client", ->
				expect(@res.body).to.deep.equal
					success: true
					project_id: @project_id

			it "should record the time taken to do the upload", ->
				@metrics.Timer::done.called.should.equal true

			it "should output a log line", ->
				@logger.log
					.calledWith(sinon.match.any, "uploaded project")
					.should.equal true

			it "should remove the uploaded file", ->
				@fs.unlink.calledWith(@path).should.equal true

		describe "when ProjectUploadManager.createProjectFromZipArchive fails", ->
			beforeEach ->
				@ProjectUploadManager.createProjectFromZipArchive =
					sinon.stub().callsArgWith(3, new Error("Something went wrong"), @project)
				@ProjectUploadController.uploadProject @req, @res

			it "should return a failed response to the FileUploader client", ->
				expect(@res.body).to.deep.equal
					success: false

			it "should output an error log line", ->
				@logger.error
					.calledWith(sinon.match.any, "error uploading project")
					.should.equal true

	describe "uploadFile", ->
		beforeEach ->
			@project_id = "project-id-123"
			@folder_id = "folder-id-123"
			@path = "/path/to/file/on/disk.png"
			@filename = "filename.png"
			@req.files =
				qqfile:
					path: @path
					name: @name
			@req.params =
				Project_id: @project_id
			@req.query =
				folder_id: @folder_id
			@fs.unlink = sinon.stub()


		describe "successfully", ->

			beforeEach ->
				@entity =
					_id : "1234"
				@FileSystemImportManager.addEntity = sinon.stub().callsArgWith(5, null, @entity)
				@ProjectUploadController.uploadFile @req, @res

			it "should insert the file into the correct project", ->
				@FileSystemImportManager.addEntity
					.calledWith(@project_id)
					.should.equal true

			it "should insert the file into the provided folder", ->
				@FileSystemImportManager.addEntity
					.calledWith(sinon.match.any, @folder_id)
					.should.equal true

			it "should insert the file with the correct name", ->
				@FileSystemImportManager.addEntity
					.calledWith(sinon.match.any, sinon.match.any, @name)
					.should.equal true

			it "should insert the file from the uploaded path", ->
				@FileSystemImportManager.addEntity
					.calledWith(sinon.match.any, sinon.match.any, sinon.match.any, @path)
					.should.equal true

			it "should return a successful response to the FileUploader client", ->
				console.log @res.body
				expect(@res.body).to.deep.equal
					success: true
					entity_id: @entity._id


			it "should output a log line", ->
				@logger.log
					.calledWith(sinon.match.any, "uploaded file")
					.should.equal true

			it "should time the request", ->
				@metrics.Timer::done.called.should.equal true

			it "should remove the uploaded file", ->
				@fs.unlink.calledWith(@path).should.equal true

		describe "when FileSystemImportManager.addEntity returns an error", ->
			beforeEach ->
				@FileSystemImportManager.addEntity = sinon.stub()
					.callsArgWith(5, new Error("Sorry something went wrong"))
				@ProjectUploadController.uploadFile @req, @res

			it "should return an unsuccessful response to the FileUploader client", ->
				expect(@res.body).to.deep.equal
					success: false

			it "should output an error log line", ->
				@logger.error
					.calledWith(sinon.match.any, "error uploading file")
					.should.equal true

