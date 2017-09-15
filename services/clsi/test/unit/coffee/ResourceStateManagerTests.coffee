SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
should = require('chai').should()
modulePath = require('path').join __dirname, '../../../app/js/ResourceStateManager'
Path = require "path"
Errors = require "../../../app/js/Errors"

describe "ResourceStateManager", ->
	beforeEach ->
		@ResourceStateManager = SandboxedModule.require modulePath, requires:
			"fs": @fs = {}
			"logger-sharelatex": {log: sinon.stub(), err: sinon.stub()}
			"./SafeReader": @SafeReader = {}
		@basePath = "/path/to/write/files/to"
		@resources = [
			{path: "resource-1-mock"}
			{path: "resource-2-mock"}
			{path: "resource-3-mock"}
		]
		@state = "1234567890"
		@resourceFileName = "#{@basePath}/.project-sync-state"
		@resourceFileContents = "#{@resources[0].path}\n#{@resources[1].path}\n#{@resources[2].path}\nstateHash:#{@state}"
		@callback = sinon.stub()

	describe "saveProjectState", ->
		beforeEach ->
			@fs.writeFile = sinon.stub().callsArg(2)

		describe "when the state is specified", ->
			beforeEach ->
				@ResourceStateManager.saveProjectState(@state, @resources, @basePath, @callback)

			it "should write the resource list to disk", ->
				@fs.writeFile
					.calledWith(@resourceFileName, @resourceFileContents)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when the state is undefined", ->
			beforeEach ->
				@state = undefined
				@fs.unlink = sinon.stub().callsArg(1)
				@ResourceStateManager.saveProjectState(@state, @resources, @basePath, @callback)

			it "should unlink the resource file", ->
				@fs.unlink
					.calledWith(@resourceFileName)
					.should.equal true

			it "should not write the resource list to disk", ->
				@fs.writeFile.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true

	describe "checkProjectStateMatches", ->

		describe "when the state matches", ->
			beforeEach ->
				@SafeReader.readFile = sinon.stub().callsArgWith(3, null, @resourceFileContents)
				@ResourceStateManager.checkProjectStateMatches(@state, @basePath, @callback)

			it "should read the resource file", ->
				@SafeReader.readFile
					.calledWith(@resourceFileName)
					.should.equal true

			it "should call the callback with the results", ->
				@callback.calledWithMatch(null, @resources).should.equal true

		describe "when the state does not match", ->
			beforeEach ->
				@SafeReader.readFile = sinon.stub().callsArgWith(3, null, @resourceFileContents)
				@ResourceStateManager.checkProjectStateMatches("not-the-original-state", @basePath, @callback)

			it "should call the callback with an error", ->
				error = new Errors.FilesOutOfSyncError("invalid state for incremental update")
				@callback.calledWith(error).should.equal true

	describe "checkResourceFiles", ->
		describe "when all the files are present", ->
			beforeEach ->
				@allFiles = [ @resources[0].path, @resources[1].path, @resources[2].path]
				@ResourceStateManager.checkResourceFiles(@resources, @allFiles, @basePath, @callback)

			it "should call the callback", ->
				@callback.calledWithExactly().should.equal true

		describe "when there is a file missing from the outputFileFinder but present on disk", ->
			beforeEach ->
				@allFiles = [ @resources[0].path, @resources[1].path]
				@fs.stat = sinon.stub().callsArg(1)
				@ResourceStateManager.checkResourceFiles(@resources, @allFiles, @basePath, @callback)

			it "should stat the file to see if it is present", ->
				@fs.stat.called.should.equal true

			it "should call the callback", ->
				@callback.calledWithExactly().should.equal true

		describe "when there is a missing file", ->
			beforeEach ->
				@allFiles = [ @resources[0].path, @resources[1].path]
				@fs.stat = sinon.stub().callsArgWith(1, new Error())
				@ResourceStateManager.checkResourceFiles(@resources, @allFiles, @basePath, @callback)

			it "should stat the file to see if it is present", ->
				@fs.stat.called.should.equal true

			it "should call the callback with an error", ->
				error = new Errors.FilesOutOfSyncError("resource files missing in incremental update")
				@callback.calledWith(error).should.equal true

		describe "when a resource contains a relative path", ->
			beforeEach ->
				@resources[0].path = "../foo/bar.tex"
				@allFiles = [ @resources[0].path, @resources[1].path, @resources[2].path]
				@ResourceStateManager.checkResourceFiles(@resources, @allFiles, @basePath, @callback)

			it "should call the callback with an error", ->
				@callback.calledWith(new Error("relative path in resource file list")).should.equal true

