sinon = require('sinon')
expect = require("chai").expect
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/Features/Uploads/ArchiveManager.js"
SandboxedModule = require('sandboxed-module')
events = require "events"

describe "ArchiveManager", ->
	beforeEach ->
		@logger =
			error: sinon.stub()
			err:->
			log: sinon.stub()
		@process = new events.EventEmitter
		@process.stdout = new events.EventEmitter
		@process.stderr = new events.EventEmitter

		@child =
			spawn: sinon.stub().returns(@process)


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
			@ArchiveManager._isZipTooLarge = sinon.stub().callsArgWith(1, null, false)

		describe "successfully", ->
			beforeEach (done) ->
				@ArchiveManager.extractZipArchive @source, @destination, done
				@process.emit "close"

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
				@process.emit "close"

			it "should return the callback with an error", ->
				@callback.calledWithExactly(new Error("Something went wrong")).should.equal true

			it "should log out the error", ->
				@logger.error.called.should.equal true

		describe "with a zip that is too large", ->
			beforeEach (done) ->
				@ArchiveManager._isZipTooLarge = sinon.stub().callsArgWith(1, null, true)
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
	
	describe "_isZipTooLarge", ->
		beforeEach ->
			@output = (totalSize)->"  Length     Date   Time    Name \n--------    ----   ----    ---- \n241  03-12-16 12:20   main.tex \n108801  03-12-16 12:20   ddd/x1J5kHh.jpg \n--------                   ------- \n#{totalSize}                   2 files\n"

		it "should return false with small output", (done)->
			@ArchiveManager._isZipTooLarge @source, (error, isTooLarge) =>
				isTooLarge.should.equal false
				done()
			@process.stdout.emit "data", @output("109042")
			@process.emit "close"

		it "should return true with large bytes", (done)->
			@ArchiveManager._isZipTooLarge @source, (error, isTooLarge) =>
				isTooLarge.should.equal true
				done()
			@process.stdout.emit "data", @output("1090000000000000042")
			@process.emit "close"

		it "should return error on no data", (done)->
			@ArchiveManager._isZipTooLarge @source, (error, isTooLarge) =>
				expect(error).to.exist
				done()
			@process.stdout.emit "data", ""
			@process.emit "close"

		it "should return error if it didn't get a number", (done)->
			@ArchiveManager._isZipTooLarge @source, (error, isTooLarge) =>
				expect(error).to.exist
				done()
			@process.stdout.emit "data", @output("total_size_string")
			@process.emit "close"

		it "should return error if the is only a bit of data", (done)->
			@ArchiveManager._isZipTooLarge @source, (error, isTooLarge) =>
				expect(error).to.exist
				done()
			@process.stdout.emit "data", "  Length     Date   Time    Name \n--------"
			@process.emit "close"

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

