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
			warn: sinon.stub()
			err:->
			log: sinon.stub()
		@metrics =
			Timer: class Timer
				done: sinon.stub()
		@zipfile = new events.EventEmitter
		@zipfile.readEntry = sinon.stub()
		@zipfile.close = sinon.stub()

		@ArchiveManager = SandboxedModule.require modulePath, requires:
			"yauzl": @yauzl = {open: sinon.stub().callsArgWith(2, null, @zipfile)}
			"logger-sharelatex": @logger
			"metrics-sharelatex": @metrics
			"fs": @fs = {}
			"fs-extra": @fse = {}
		@callback = sinon.stub()
	
	describe "extractZipArchive", ->
		beforeEach ->
			@source = "/path/to/zip/source.zip"
			@destination = "/path/to/zip/destination"
			@ArchiveManager._isZipTooLarge = sinon.stub().callsArgWith(1, null, false)

		describe "successfully", ->
			beforeEach (done) ->
				@ArchiveManager.extractZipArchive @source, @destination, done
				@zipfile.emit "end"

			it "should run yauzl", ->
				@yauzl.open.calledWith(@source).should.equal true

			it "should time the unzip", ->
				@metrics.Timer::done.called.should.equal true

			it "should log the unzip", ->
				@logger.log.calledWith(sinon.match.any, "unzipping file").should.equal true

		describe "with an error in the zip file header", ->
			beforeEach (done) ->
				@yauzl.open = sinon.stub().callsArgWith(2, new Error("Something went wrong"))
				@ArchiveManager.extractZipArchive @source, @destination, (error) =>
					@callback(error)
					done()

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

			it "should not call yauzl.open", ->
				@yauzl.open.called.should.equal false

		describe "with an error in the extracted files", ->
			beforeEach (done) ->
				@ArchiveManager.extractZipArchive @source, @destination, (error) =>
					@callback(error)
					done()
				@zipfile.emit "error", new Error("Something went wrong")

			it "should return the callback with an error", ->
				@callback.calledWithExactly(new Error("Something went wrong")).should.equal true

			it "should log out the error", ->
				@logger.error.called.should.equal true

		describe "with a relative extracted file path", ->
			beforeEach (done) ->
				@zipfile.openReadStream = sinon.stub()
				@ArchiveManager.extractZipArchive @source, @destination, (error) =>
					@callback(error)
					done()
				@zipfile.emit "entry", {fileName: "../testfile.txt"}
				@zipfile.emit "end"

			it "should not write try to read the file entry", ->
				@zipfile.openReadStream.called.should.equal false

			it "should log out a warning", ->
				@logger.warn.called.should.equal true

		describe "with an unnormalized extracted file path", ->
			beforeEach (done) ->
				@zipfile.openReadStream = sinon.stub()
				@ArchiveManager.extractZipArchive @source, @destination, (error) =>
					@callback(error)
					done()
				@zipfile.emit "entry", {fileName: "foo/./testfile.txt"}
				@zipfile.emit "end"

			it "should not write try to read the file entry", ->
				@zipfile.openReadStream.called.should.equal false

			it "should log out a warning", ->
				@logger.warn.called.should.equal true

		describe "with a directory entry", ->
			beforeEach (done) ->
				@zipfile.openReadStream = sinon.stub()
				@ArchiveManager.extractZipArchive @source, @destination, (error) =>
					@callback(error)
					done()
				@zipfile.emit "entry", {fileName: "testdir/"}
				@zipfile.emit "end"

			it "should not write try to read the entry", ->
				@zipfile.openReadStream.called.should.equal false

			it "should not log out a warning", ->
				@logger.warn.called.should.equal false

		describe "with an error opening the file read stream", ->
			beforeEach (done) ->
				@zipfile.openReadStream = sinon.stub().callsArgWith(1, new Error("Something went wrong"))
				@writeStream = new events.EventEmitter
				@ArchiveManager.extractZipArchive @source, @destination, (error) =>
					@callback(error)
					done()
				@zipfile.emit "entry", {fileName: "testfile.txt"}
				@zipfile.emit "end"

			it "should return the callback with an error", ->
				@callback.calledWithExactly(new Error("Something went wrong")).should.equal true

			it "should log out the error", ->
				@logger.error.called.should.equal true

			it "should close the zipfile", ->
				@zipfile.close.called.should.equal true

		describe "with an error in the file read stream", ->
			beforeEach (done) ->
				@readStream = new events.EventEmitter
				@readStream.pipe = sinon.stub()
				@zipfile.openReadStream = sinon.stub().callsArgWith(1, null, @readStream)
				@writeStream = new events.EventEmitter
				@fs.createWriteStream = sinon.stub().returns @writeStream
				@fse.ensureDir = sinon.stub().callsArg(1)
				@ArchiveManager.extractZipArchive @source, @destination, (error) =>
					@callback(error)
					done()
				@zipfile.emit "entry", {fileName: "testfile.txt"}
				@readStream.emit "error", new Error("Something went wrong")
				@zipfile.emit "end"

			it "should return the callback with an error", ->
				@callback.calledWithExactly(new Error("Something went wrong")).should.equal true

			it "should log out the error", ->
				@logger.error.called.should.equal true

			it "should close the zipfile", ->
				@zipfile.close.called.should.equal true

		describe "with an error in the file write stream", ->
			beforeEach (done) ->
				@readStream = new events.EventEmitter
				@readStream.pipe = sinon.stub()
				@readStream.unpipe = sinon.stub()
				@readStream.destroy = sinon.stub()
				@zipfile.openReadStream = sinon.stub().callsArgWith(1, null, @readStream)
				@writeStream = new events.EventEmitter
				@fs.createWriteStream = sinon.stub().returns @writeStream
				@fse.ensureDir = sinon.stub().callsArg(1)
				@ArchiveManager.extractZipArchive @source, @destination, (error) =>
					@callback(error)
					done()
				@zipfile.emit "entry", {fileName: "testfile.txt"}
				@writeStream.emit "error", new Error("Something went wrong")
				@zipfile.emit "end"

			it "should return the callback with an error", ->
				@callback.calledWithExactly(new Error("Something went wrong")).should.equal true

			it "should log out the error", ->
				@logger.error.called.should.equal true

			it "should unpipe from the readstream", ->
				@readStream.unpipe.called.should.equal true

			it "should destroy the readstream", ->
				@readStream.destroy.called.should.equal true

			it "should close the zipfile", ->
				@zipfile.close.called.should.equal true

	describe "_isZipTooLarge", ->

		it "should return false with small output", (done)->
			@ArchiveManager._isZipTooLarge @source, (error, isTooLarge) =>
				isTooLarge.should.equal false
				done()
			@zipfile.emit "entry", {uncompressedSize: 109042}
			@zipfile.emit "end"

		it "should return true with large bytes", (done)->
			@ArchiveManager._isZipTooLarge @source, (error, isTooLarge) =>
				isTooLarge.should.equal true
				done()
			@zipfile.emit "entry", {uncompressedSize: 1090000000000000042}
			@zipfile.emit "end"

		it "should return error on no data", (done)->
			@ArchiveManager._isZipTooLarge @source, (error, isTooLarge) =>
				expect(error).to.exist
				done()
			@zipfile.emit "entry", {}
			@zipfile.emit "end"

		it "should return error if it didn't get a number", (done)->
			@ArchiveManager._isZipTooLarge @source, (error, isTooLarge) =>
				expect(error).to.exist
				done()
			@zipfile.emit "entry", {uncompressedSize:"random-error"}
			@zipfile.emit "end"

		it "should return error if there is no data", (done)->
			@ArchiveManager._isZipTooLarge @source, (error, isTooLarge) =>
				expect(error).to.exist
				done()
			@zipfile.emit "end"

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

