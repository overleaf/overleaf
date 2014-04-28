sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Downloads/ProjectZipStreamManager.js"
SandboxedModule = require('sandboxed-module')

describe "ProjectZipStreamManager", ->
	beforeEach ->
		@project_id = "project-id-123"
		@callback = sinon.stub()
		@archive = 
			on:->
		@ProjectZipStreamManager = SandboxedModule.require modulePath, requires:
			"archiver": @archiver = sinon.stub().returns @archive
			"logger-sharelatex": @logger = {error: sinon.stub(), log: sinon.stub()}
			"../Project/ProjectEntityHandler" : @ProjectEntityHandler = {}
			"../FileStore/FileStoreHandler": @FileStoreHandler = {}

	describe "createZipStreamForProject", ->
		describe "successfully", ->
			beforeEach ->
				@ProjectZipStreamManager.addAllDocsToArchive = sinon.stub().callsArg(2)
				@ProjectZipStreamManager.addAllFilesToArchive = sinon.stub().callsArg(2)
				@archive.finalize = sinon.stub()
				@ProjectZipStreamManager.createZipStreamForProject @project_id, @callback

			it "should create a zip archive", ->
				@archiver.calledWith("zip").should.equal true

			it "should return a stream before any processing is done", ->
				@callback.calledWith(sinon.match.falsy, @archive).should.equal true
				@callback.calledBefore(@ProjectZipStreamManager.addAllDocsToArchive).should.equal true
				@callback.calledBefore(@ProjectZipStreamManager.addAllFilesToArchive).should.equal true

			it "should add all of the project docs to the zip", ->
				@ProjectZipStreamManager.addAllDocsToArchive
					.calledWith(@project_id, @archive)
					.should.equal true

			it "should add all of the project files to the zip", ->
				@ProjectZipStreamManager.addAllFilesToArchive
					.calledWith(@project_id, @archive)
					.should.equal true

			it "should finalise the stream", ->
				@archive.finalize.called.should.equal true

		describe "with an error adding docs", ->
			beforeEach ->
				@ProjectZipStreamManager.addAllDocsToArchive =
					sinon.stub().callsArgWith(2, new Error("something went wrong"))
				@ProjectZipStreamManager.addAllFilesToArchive = sinon.stub().callsArg(2)
				@archive.finalize = sinon.stub()
				@ProjectZipStreamManager.createZipStreamForProject @project_id, @callback

			it "should log out an error", ->
				@logger.error.calledWith(sinon.match.any, "error adding docs to zip stream")
					.should.equal true

			it "should continue with the process", ->
				@ProjectZipStreamManager.addAllDocsToArchive.called.should.equal true
				@ProjectZipStreamManager.addAllFilesToArchive.called.should.equal true
				@archive.finalize.called.should.equal true

		describe "with an error adding files", ->
			beforeEach ->
				@ProjectZipStreamManager.addAllDocsToArchive = sinon.stub().callsArg(2)
				@ProjectZipStreamManager.addAllFilesToArchive =
					sinon.stub().callsArgWith(2, new Error("something went wrong"))
				@archive.finalize = sinon.stub()
				@ProjectZipStreamManager.createZipStreamForProject @project_id, @callback

			it "should log out an error", ->
				@logger.error.calledWith(sinon.match.any, "error adding files to zip stream")
					.should.equal true

			it "should continue with the process", ->
				@ProjectZipStreamManager.addAllDocsToArchive.called.should.equal true
				@ProjectZipStreamManager.addAllFilesToArchive.called.should.equal true
				@archive.finalize.called.should.equal true

	describe "addAllDocsToArchive", ->
		beforeEach (done) ->
			@docs =
				"/main.tex":
					lines: ["\\documentclass{article}", "\\begin{document}", "Hello world", "\\end{document}"]
				"/chapters/chapter1.tex":
					lines: ["chapter1", "content"]
			@ProjectEntityHandler.getAllDocs = sinon.stub().callsArgWith(1, null, @docs)
			@archive.append = sinon.stub()
			@ProjectZipStreamManager.addAllDocsToArchive @project_id, @archive, (error) =>
				@callback(error)
				done()

		it "should get the docs for the project", ->
			@ProjectEntityHandler.getAllDocs
				.calledWith(@project_id)
				.should.equal true

		it "should add each doc to the archive", ->
			for path, doc of @docs
				path = path.slice(1) # remove "/"
				@archive.append.calledWith(doc.lines.join("\n"), name: path)
					.should.equal true

	describe "addAllFilesToArchive", ->
		beforeEach ->
			@files =
				"/image.png":
					_id: "file-id-1"
				"/folder/picture.png":
					_id: "file-id-2"
			@streams =
				"file-id-1" : "stream-mock-1"
				"file-id-2" : "stream-mock-2"
			@ProjectEntityHandler.getAllFiles = sinon.stub().callsArgWith(1, null, @files)
			@archive.append = sinon.stub()
			@FileStoreHandler.getFileStream = (project_id, file_id, {}, callback) =>
				callback null, @streams[file_id]
			sinon.spy @FileStoreHandler, "getFileStream"
			@ProjectZipStreamManager.addAllFilesToArchive @project_id, @archive, @callback

		it "should get the files for the project", ->
			@ProjectEntityHandler.getAllFiles.calledWith(@project_id).should.equal true

		it "should get a stream for each file", ->
			for path, file of @files
				@FileStoreHandler.getFileStream.calledWith(@project_id, file._id).should.equal true

		it "should add each file to the archive", ->
			for path, file of @files
				path = path.slice(1) # remove "/"
				@archive.append.calledWith(@streams[file._id], name: path).should.equal true







