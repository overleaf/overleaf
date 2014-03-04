assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../app/js/FileHandler.js"
SandboxedModule = require('sandboxed-module')

describe "FileHandler", ->

	beforeEach ->
		@settings =
			s3:
				buckets:
					user_files:"user_files"
		@PersistorManager =
			getFileStream: sinon.stub()
			checkIfFileExists: sinon.stub()
			deleteFile: sinon.stub()
			deleteDirectory: sinon.stub()
			sendStream: sinon.stub()
			insertFile: sinon.stub()
		@LocalFileWriter =
			writeStream: sinon.stub()
			deleteFile: sinon.stub()
		@FileConverter =
			convert: sinon.stub()
			thumbnail: sinon.stub()
			preview: sinon.stub()
		@keyBuilder =
			addCachingToKey: sinon.stub()
			getConvertedFolderKey: sinon.stub()
		@ImageOptimiser =
			compressPng: sinon.stub()
		@handler = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @settings
			"./PersistorManager":@PersistorManager
			"./LocalFileWriter":@LocalFileWriter
			"./FileConverter":@FileConverter
			"./KeyBuilder": @keyBuilder
			"./ImageOptimiser":@ImageOptimiser
			"logger-sharelatex":
				log:->
				err:->
		@bucket = "my_bucket"
		@key = "key/here"
		@stubbedPath = "/var/somewhere/path"
		@format = "png"
		@formattedStubbedPath = "#{@stubbedPath}.#{@format}"

	describe "insertFile", ->
		beforeEach ->
			@stream = {}
			@PersistorManager.deleteDirectory.callsArgWith(2)
			@PersistorManager.sendStream.callsArgWith(3)

		it "should send file to the filestore", (done)->
			@handler.insertFile @bucket, @key, @stream, =>
				@PersistorManager.sendStream.calledWith(@bucket, @key, @stream).should.equal true
				done()

		it "should delete the convetedKey folder", (done)->
			@keyBuilder.getConvertedFolderKey.returns(@stubbedConvetedKey)
			@handler.insertFile @bucket, @key, @stream, =>
				@PersistorManager.deleteDirectory.calledWith(@bucket, @stubbedConvetedKey).should.equal true
				done()

	describe "deleteFile", ->
		beforeEach ->
			@keyBuilder.getConvertedFolderKey.returns(@stubbedConvetedKey)
			@PersistorManager.deleteFile.callsArgWith(2)

		it "should tell the filestore manager to delete the file", (done)->
			@handler.deleteFile @bucket, @key, =>
				@PersistorManager.deleteFile.calledWith(@bucket, @key).should.equal true
				done()

		it "should tell the filestore manager to delete the cached foler", (done)->
			@handler.deleteFile @bucket, @key, =>
				@PersistorManager.deleteFile.calledWith(@bucket, @stubbedConvetedKey).should.equal true
				done()

	describe "getFile", ->
		beforeEach ->
			@handler._getStandardFile = sinon.stub().callsArgWith(3)
			@handler._getConvertedFile = sinon.stub().callsArgWith(3)

		it "should call _getStandardFile if no format or style are defined", (done)->

			@handler.getFile @bucket, @key, null, =>
				@handler._getStandardFile.called.should.equal true
				@handler._getConvertedFile.called.should.equal false
				done()

		it "should call _getConvertedFile if a format is defined", (done)->
			@handler.getFile @bucket, @key, format:"png", =>
				@handler._getStandardFile.called.should.equal false
				@handler._getConvertedFile.called.should.equal true
				done()


	describe "_getStandardFile", ->

		beforeEach ->
			@fileStream = {on:->}
			@PersistorManager.getFileStream.callsArgWith(2, "err", @fileStream)

		it "should get the stream", (done)->
			@handler.getFile @bucket, @key, null, =>
				@PersistorManager.getFileStream.calledWith(@bucket, @key).should.equal true
				done()

		it "should return the stream and error", (done)->
			@handler.getFile @bucket, @key, null, (err, stream)=>
				err.should.equal "err"
				stream.should.equal @fileStream
				done()

	describe "_getConvertedFile", ->

		it "should getFileStream if it does exists", (done)->
			@PersistorManager.checkIfFileExists.callsArgWith(2, null, true)
			@PersistorManager.getFileStream.callsArgWith(2)
			@handler._getConvertedFile @bucket, @key, {}, =>
				@PersistorManager.getFileStream.calledWith(@bucket).should.equal true
				done()

		it "should call _getConvertedFileAndCache if it does exists", (done)->
			@PersistorManager.checkIfFileExists.callsArgWith(2, null, false)
			@handler._getConvertedFileAndCache = sinon.stub().callsArgWith(4)
			@handler._getConvertedFile @bucket, @key, {}, =>
				@handler._getConvertedFileAndCache.calledWith(@bucket, @key).should.equal true
				done()

	describe "_getConvertedFileAndCache", ->

		it "should _convertFile ", (done)->
			@stubbedStream = {"something":"here"}
			@PersistorManager.sendFile = sinon.stub().callsArgWith(3)
			@PersistorManager.getFileStream = sinon.stub().callsArgWith(2, null, @stubbedStream)
			@convetedKey = @key+"converted"
			@handler._convertFile = sinon.stub().callsArgWith(3, null, @stubbedPath)
			@ImageOptimiser.compressPng = sinon.stub().callsArgWith(1)
			@handler._getConvertedFileAndCache @bucket, @key, @convetedKey, {}, (err, fsStream)=>
				@handler._convertFile.called.should.equal true
				@PersistorManager.sendFile.calledWith(@bucket, @convetedKey, @stubbedPath).should.equal true
				@PersistorManager.getFileStream.calledWith(@bucket, @convetedKey).should.equal true
				@ImageOptimiser.compressPng.calledWith(@stubbedPath).should.equal true
				fsStream.should.equal @stubbedStream
				done()

	describe "_convertFile", ->
		beforeEach ->
			@FileConverter.convert.callsArgWith(2, null, @formattedStubbedPath)
			@FileConverter.thumbnail.callsArgWith(1, null, @formattedStubbedPath)
			@FileConverter.preview.callsArgWith(1, null, @formattedStubbedPath)
			@handler._writeS3FileToDisk = sinon.stub().callsArgWith(2, null, @stubbedPath)
			@LocalFileWriter.deleteFile.callsArgWith(1)

		it "should call thumbnail on the writer path if style was thumbnail was specified", (done)->
			@handler._convertFile @bucket, @key, style:"thumbnail", (err, path)=>
				path.should.equal @formattedStubbedPath
				@FileConverter.thumbnail.calledWith(@stubbedPath).should.equal true
				@LocalFileWriter.deleteFile.calledWith(@stubbedPath).should.equal true
				done()

		it "should call preview on the writer path if style was preview was specified", (done)->
			@handler._convertFile @bucket, @key, style:"preview", (err, path)=>
				path.should.equal @formattedStubbedPath
				@FileConverter.preview.calledWith(@stubbedPath).should.equal true
				@LocalFileWriter.deleteFile.calledWith(@stubbedPath).should.equal true
				done()

		it "should call convert on the writer path if a format was specified", (done)->
			@handler._convertFile @bucket, @key, format:@format, (err, path)=>
				path.should.equal @formattedStubbedPath
				@FileConverter.convert.calledWith(@stubbedPath, @format).should.equal true
				@LocalFileWriter.deleteFile.calledWith(@stubbedPath).should.equal true
				done()



				
