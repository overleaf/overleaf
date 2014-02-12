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
		@metrics =
			Timer: class Timer
				done: sinon.stub()
		@ArchiveManager = SandboxedModule.require modulePath, requires:
			"child_process": @child
			"logger-sharelatex": @logger
			"../../infrastructure/Metrics": @metrics
	
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

