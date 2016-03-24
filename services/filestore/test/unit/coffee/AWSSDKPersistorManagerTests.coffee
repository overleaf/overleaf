sinon = require 'sinon'
chai = require 'chai'

should = chai.should()
expect = chai.expect

modulePath = "../../../app/js/AWSSDKPersistorManager.js"
SandboxedModule = require 'sandboxed-module'

describe "AWSSDKPersistorManager", ->
	beforeEach ->
		@settings =
			filestore:
				backend: "aws-sdk"
		@s3 =
			upload: sinon.stub()
			getObject: sinon.stub()
			copyObject: sinon.stub()
			deleteObject: sinon.stub()
			listObjects: sinon.stub()
			deleteObjects: sinon.stub()
			headObject: sinon.stub()
		@awssdk =
			S3: sinon.stub().returns @s3

		@requires =
			"aws-sdk": @awssdk
			"settings-sharelatex": @settings
			"logger-sharelatex":
				log:->
				err:->
			"fs": @fs =
				createReadStream: sinon.stub()
			"./Errors": @Errors =
				NotFoundError: sinon.stub()
		@key = "my/key"
		@bucketName = "my-bucket"
		@error = "my error"
		@AWSSDKPersistorManager = SandboxedModule.require modulePath, requires: @requires

	describe "sendFile", ->
		beforeEach ->
			@stream = {}
			@fsPath = "/usr/local/some/file"
			@fs.createReadStream.returns @stream

		it "should put the file with s3.upload", (done) ->
			@s3.upload.callsArgWith 1
			@AWSSDKPersistorManager.sendFile @bucketName, @key, @fsPath, (err) =>
				expect(err).to.not.be.ok
				expect(@s3.upload.calledOnce, "called only once").to.be.true
				expect((@s3.upload.calledWith Bucket: @bucketName, Key: @key, Body: @stream)
							 , "called with correct arguments").to.be.true
				done()

		it "should dispatch the error from s3.upload", (done) ->
			@s3.upload.callsArgWith 1, @error
			@AWSSDKPersistorManager.sendFile @bucketName, @key, @fsPath, (err) =>
				expect(err).to.equal @error
				done()


	describe "sendStream", ->
		beforeEach ->
			@stream = {}

		it "should put the file with s3.upload", (done) ->
			@s3.upload.callsArgWith 1
			@AWSSDKPersistorManager.sendStream @bucketName, @key, @stream, (err) =>
				expect(err).to.not.be.ok
				expect(@s3.upload.calledOnce, "called only once").to.be.true
				expect((@s3.upload.calledWith Bucket: @bucketName, Key: @key, Body: @stream),
							 "called with correct arguments").to.be.true
				done()

		it "should dispatch the error from s3.upload", (done) ->
			@s3.upload.callsArgWith 1, @error
			@AWSSDKPersistorManager.sendStream @bucketName, @key, @stream, (err) =>
				expect(err).to.equal @error
				done()

	describe "getFileStream", ->
		beforeEach ->
			@opts = {}
			@stream = {}
			@read_stream =
				on: @read_stream_on = sinon.stub()
			@object =
				createReadStream: sinon.stub().returns @read_stream
			@s3.getObject.returns @object

		it "should return a stream from s3.getObject", (done) ->
			@read_stream_on.withArgs('readable').callsArgWith 1

			@AWSSDKPersistorManager.getFileStream @bucketName, @key, @opts, (err, stream) =>
				expect(@read_stream_on.calledTwice)
				expect(err).to.not.be.ok
				expect(stream, "returned the stream").to.equal @read_stream
				expect((@s3.getObject.calledWith Bucket: @bucketName, Key: @key),
							 "called with correct arguments").to.be.true
				done()

		describe "with start and end options", ->
			beforeEach ->
				@opts =
					start: 0
					end: 8
			it "should pass headers to the s3.GetObject", (done) ->
				@read_stream_on.withArgs('readable').callsArgWith 1
				@AWSSDKPersistorManager.getFileStream @bucketName, @key, @opts, (err, stream) =>
					expect((@s3.getObject.calledWith Bucket: @bucketName, Key: @key, Range: 'bytes=0-8'),
						"called with correct arguments").to.be.true
				done()

		describe "error conditions", ->
			describe "when the file doesn't exist", ->
				beforeEach ->
					@error = new Error()
					@error.code = 'NoSuchKey'
				it "should produce a NotFoundError", (done) ->
					@read_stream_on.withArgs('error').callsArgWith 1, @error
					@AWSSDKPersistorManager.getFileStream @bucketName, @key, @opts, (err, stream) =>
						expect(stream).to.not.be.ok
						expect(err).to.be.ok
						expect(err instanceof @Errors.NotFoundError, "error is a correct instance").to.equal true
						done()

			describe "when there is some other error", ->
				beforeEach ->
					@error = new Error()
				it "should dispatch the error from s3 object stream", (done) ->
					@read_stream_on.withArgs('error').callsArgWith 1, @error
					@AWSSDKPersistorManager.getFileStream @bucketName, @key, @opts, (err, stream) =>
						expect(stream).to.not.be.ok
						expect(err).to.be.ok
						expect(err).to.equal @error
						done()

	describe "copyFile", ->
		beforeEach ->
			@destKey = "some/key"
			@stream = {}

		it "should copy the file with s3.copyObject", (done) ->
			@s3.copyObject.callsArgWith 1
			@AWSSDKPersistorManager.copyFile @bucketName, @key, @destKey, (err) =>
				expect(err).to.not.be.ok
				expect(@s3.copyObject.calledOnce, "called only once").to.be.true
				expect((@s3.copyObject.calledWith Bucket: @bucketName, Key: @destKey, CopySource: @bucketName + '/' + @key),
					"called with correct arguments").to.be.true
				done()

		it "should dispatch the error from s3.copyObject", (done) ->
			@s3.copyObject.callsArgWith 1, @error
			@AWSSDKPersistorManager.copyFile @bucketName, @key, @destKey, (err) =>
				expect(err).to.equal @error
				done()

	describe "deleteFile", ->
		it "should delete the file with s3.deleteObject", (done) ->
			@s3.deleteObject.callsArgWith 1
			@AWSSDKPersistorManager.deleteFile @bucketName, @key, (err) =>
				expect(err).to.not.be.ok
				expect(@s3.deleteObject.calledOnce, "called only once").to.be.true
				expect((@s3.deleteObject.calledWith Bucket: @bucketName, Key: @key),
					"called with correct arguments").to.be.true
				done()

		it "should dispatch the error from s3.deleteObject", (done) ->
			@s3.deleteObject.callsArgWith 1, @error
			@AWSSDKPersistorManager.deleteFile @bucketName, @key, (err) =>
				expect(err).to.equal @error
				done()

	describe "deleteDirectory", ->

		it "should list the directory content using s3.listObjects", (done) ->
			@s3.listObjects.callsArgWith 1, null, Contents: []
			@AWSSDKPersistorManager.deleteDirectory @bucketName, @key, (err) =>
				expect(err).to.not.be.ok
				expect(@s3.listObjects.calledOnce, "called only once").to.be.true
				expect((@s3.listObjects.calledWith Bucket: @bucketName, Prefix: @key),
					"called with correct arguments").to.be.true
				done()

		it "should dispatch the error from s3.listObjects", (done) ->
			@s3.listObjects.callsArgWith 1, @error
			@AWSSDKPersistorManager.deleteDirectory @bucketName, @key, (err) =>
				expect(err).to.equal @error
				done()

		describe "with directory content", ->
			beforeEach ->
				@fileList = [
					Key: 'foo'
				, Key: 'bar'
				, Key: 'baz'
				]

			it "should forward the file keys to s3.deleteObjects", (done) ->
				@s3.listObjects.callsArgWith 1, null, Contents: @fileList
				@s3.deleteObjects.callsArgWith 1
				@AWSSDKPersistorManager.deleteDirectory @bucketName, @key, (err) =>
					expect(err).to.not.be.ok
					expect(@s3.deleteObjects.calledOnce, "called only once").to.be.true
					expect((@s3.deleteObjects.calledWith
							Bucket: @bucketName
							Delete:
								Quiet: true
								Objects: @fileList),
						"called with correct arguments").to.be.true
					done()

			it "should dispatch the error from s3.deleteObjects", (done) ->
				@s3.listObjects.callsArgWith 1, null, Contents: @fileList
				@s3.deleteObjects.callsArgWith 1, @error
				@AWSSDKPersistorManager.deleteDirectory @bucketName, @key, (err) =>
					expect(err).to.equal @error
					done()


	describe "checkIfFileExists", ->

		it "should check for the file with s3.headObject", (done) ->
			@s3.headObject.callsArgWith 1, null, {}
			@AWSSDKPersistorManager.checkIfFileExists @bucketName, @key, (err, exists) =>
				expect(err).to.not.be.ok
				expect(@s3.headObject.calledOnce, "called only once").to.be.true
				expect((@s3.headObject.calledWith Bucket: @bucketName, Key: @key),
					"called with correct arguments").to.be.true
				done()

		it "should return false on an inexistant file", (done) ->
			@s3.headObject.callsArgWith 1, null, {}
			@AWSSDKPersistorManager.checkIfFileExists @bucketName, @key, (err, exists) =>
				expect(exists).to.be.false
				done()

		it "should return true on an existing file", (done) ->
			@s3.headObject.callsArgWith 1, null, ETag: "etag"
			@AWSSDKPersistorManager.checkIfFileExists @bucketName, @key, (err, exists) =>
				expect(exists).to.be.true
				done()

		it "should dispatch the error from s3.headObject", (done) ->
			@s3.headObject.callsArgWith 1, @error
			@AWSSDKPersistorManager.checkIfFileExists @bucketName, @key, (err, exists) =>
				expect(err).to.equal @error
				done()

	describe "directorySize", ->

		it "should list the directory content using s3.listObjects", (done) ->
			@s3.listObjects.callsArgWith 1, null, Contents: []
			@AWSSDKPersistorManager.directorySize @bucketName, @key, (err) =>
				expect(err).to.not.be.ok
				expect(@s3.listObjects.calledOnce, "called only once").to.be.true
				expect((@s3.listObjects.calledWith Bucket: @bucketName, Prefix: @key),
					"called with correct arguments").to.be.true
				done()

		it "should dispatch the error from s3.listObjects", (done) ->
			@s3.listObjects.callsArgWith 1, @error
			@AWSSDKPersistorManager.directorySize @bucketName, @key, (err) =>
				expect(err).to.equal @error
				done()

		it "should sum directory files sizes", (done) ->
			@s3.listObjects.callsArgWith 1, null, Contents: [ { Size: 1024 }, { Size: 2048 }]
			@AWSSDKPersistorManager.directorySize @bucketName, @key, (err, size) =>
				expect(size).to.equal 3072
				done()
