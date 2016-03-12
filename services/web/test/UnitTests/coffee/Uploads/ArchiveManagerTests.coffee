sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/Features/Uploads/ArchiveManager.js"
SandboxedModule = require('sandboxed-module')
events = require "events"

describe "ArchiveManager", ->
	beforeEach ->
		@logger =
			error: sinon.stub()
			log: sinon.stub()
		@process = new events.EventEmitter
		@process.stdout = new events.EventEmitter
		@process.stderr = new events.EventEmitter
		@child =
			spawn: sinon.stub().returns(@process)
			exec: sinon.stub().callsArgWith(1, null, "   109042                   2 files")
		@metrics =
			Timer: class Timer
				done: sinon.stub()
		@ArchiveManager = SandboxedModule.require modulePath, requires:
			"child_process": @child
			"logger-sharelatex": @logger
			"../../infrastructure/Metrics": @metrics
			"fs": @fs = {}
	
	describe "extractZipArchive", ->
		beforeEach ->
			@source = "/path/to/zip/source.zip"
			@destination = "/path/to/zip/destination"
			@callback = sinon.stub()

		describe "successfully", ->
			beforeEach (done) ->
				@ArchiveManager.extractZipArchive @source, @destination, done
				@process.emit "exit"

			it "should run unzip", ->
				@child.spawn.calledWithExactly("unzip", [@source, "-d", @destination]).should.equal true

			it "should time the unzip", ->
				@metrics.Timer::done.called.should.equal true

			it "should log the unzip", ->
				@logger.log.calledWith(sinon.match.any, "unzipping file").should.equal true

		describe "with an error on stderr", ->
			beforeEach (done) ->
				@ArchiveManager.extractZipArchive @source, @destination, (error) =>
					@callback(error)
					done()
				@process.stderr.emit "data", "Something went wrong"
				@process.emit "exit"

			it "should return the callback with an error", ->
				@callback.calledWithExactly(new Error("Something went wrong")).should.equal true

			it "should log out the error", ->
				@logger.error.called.should.equal true

		describe "with a zip that is too large", ->
			beforeEach (done) ->
				@child.exec = sinon.stub().callsArgWith(1, null, "   10000000000009042                   2 files")
				@ArchiveManager.extractZipArchive @source, @destination, (error) =>
					@callback(error)
					done()

			it "should return the callback with an error", ->
				@callback.calledWithExactly(new Error("zip_too_large")).should.equal true

			it "should not call spawn", ->
				@child.spawn.called.should.equal false

		describe "with an error on the process", ->
			beforeEach (done) ->
				@ArchiveManager.extractZipArchive @source, @destination, (error) =>
					@callback(error)
					done()
				@process.emit "error", new Error("Something went wrong")

			it "should return the callback with an error", ->
				@callback.calledWithExactly(new Error("Something went wrong")).should.equal true

			it "should log out the error", ->
				@logger.error.called.should.equal true
	
	describe "findTopLevelDirectory", ->
		beforeEach ->
			@fs.readdir = sinon.stub()
			@fs.stat = sinon.stub()
			@directory = "test/directory"

		describe "with multiple files", ->
			beforeEach ->
				@fs.readdir.callsArgWith(1, null, ["multiple", "files"])
				@ArchiveManager.findTopLevelDirectory(@directory, @callback)
			
			it "should find the files in the directory", ->
				@fs.readdir
					.calledWith(@directory)
					.should.equal true
			
			it "should return the original directory", ->
				@callback
					.calledWith(null, @directory)
					.should.equal true
		
		describe "with a single file (not folder)", ->
			beforeEach ->
				@fs.readdir.callsArgWith(1, null, ["foo.tex"])
				@fs.stat.callsArgWith(1, null, { isDirectory: () -> false })
				@ArchiveManager.findTopLevelDirectory(@directory, @callback)
			
			it "should check if the file is a directory", ->
				@fs.stat
					.calledWith(@directory + "/foo.tex")
					.should.equal true
			
			it "should return the original directory", ->
				@callback
					.calledWith(null, @directory)
					.should.equal true
		
		describe "with a single top-level folder", ->
			beforeEach ->
				@fs.readdir.callsArgWith(1, null, ["folder"])
				@fs.stat.callsArgWith(1, null, { isDirectory: () -> true })
				@ArchiveManager.findTopLevelDirectory(@directory, @callback)
			
			it "should check if the file is a directory", ->
				@fs.stat
					.calledWith(@directory + "/folder")
					.should.equal true
			
			it "should return the child directory", ->
				@callback
					.calledWith(null, @directory + "/folder")
					.should.equal true

