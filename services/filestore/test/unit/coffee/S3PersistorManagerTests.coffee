assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../app/js/S3PersistorManager.js"
SandboxedModule = require('sandboxed-module')

describe "S3PersistorManagerTests", ->

	beforeEach ->
		@settings =
			filestore:
				backend: "s3"
				s3:
					secret: "secret"
					key: "this_key"
				stores:
					user_files:"sl_user_files"
		@knoxClient =
			putFile:sinon.stub()
			copyFile:sinon.stub()
			list: sinon.stub()
			deleteMultiple: sinon.stub()
			get: sinon.stub()
		@knox =
			createClient: sinon.stub().returns(@knoxClient)
		@s3EventHandlers = {}
		@s3Request =
			on: sinon.stub().callsFake (event, callback) =>
				@s3EventHandlers[event] = callback
			send: sinon.stub()
		@s3Response =
			httpResponse:
				createUnbufferedStream: sinon.stub()
		@s3Client =
			copyObject: sinon.stub()
			headObject: sinon.stub()
			getObject: sinon.stub().returns(@s3Request)
		@awsS3 = sinon.stub().returns(@s3Client)
		@LocalFileWriter =
			writeStream: sinon.stub()
			deleteFile: sinon.stub()
		@request = sinon.stub()
		@requires =
			"knox": @knox
			"aws-sdk/clients/s3": @awsS3
			"settings-sharelatex": @settings
			"./LocalFileWriter":@LocalFileWriter
			"logger-sharelatex":
				log:->
				err:->
			"request": @request
			"./Errors": @Errors =
				NotFoundError: sinon.stub()
		@key = "my/key"
		@bucketName = "my-bucket"
		@error = "my errror"
		@S3PersistorManager = SandboxedModule.require modulePath, requires: @requires

	describe "getFileStream", ->
		describe "success", ->
			beforeEach () ->
				@expectedStream = { expectedStream: true }
				@s3Request.send.callsFake () =>
					@s3EventHandlers.httpHeaders(200, {}, @s3Response, "OK")
				@s3Response.httpResponse.createUnbufferedStream.returns(@expectedStream)

			it "returns a stream", (done) ->
				@S3PersistorManager.getFileStream @bucketName, @key, {}, (err, stream) =>
					if err?
						return done(err)
					expect(stream).to.equal(@expectedStream)
					done()

			it "sets the AWS client up with credentials from settings", (done) ->
				@S3PersistorManager.getFileStream @bucketName, @key, {}, (err, stream) =>
					if err?
						return done(err)
					expect(@awsS3.lastCall.args).to.deep.equal([{
						credentials:
							accessKeyId: @settings.filestore.s3.key
							secretAccessKey: @settings.filestore.s3.secret
					}])
					done()

			it "fetches the right key from the right bucket", (done) ->
				@S3PersistorManager.getFileStream @bucketName, @key, {}, (err, stream) =>
					if err?
						return done(err)
					expect(@s3Client.getObject.lastCall.args).to.deep.equal([{
						Bucket: @bucketName,
						Key: @key
					}])
					done()

			it "accepts alternative credentials", (done) ->
				accessKeyId = "that_key"
				secret = "that_secret"
				opts = {
					credentials:
						auth_key: accessKeyId
						auth_secret: secret
				}
				@S3PersistorManager.getFileStream @bucketName, @key, opts, (err, stream) =>
					if err?
						return done(err)
					expect(@awsS3.lastCall.args).to.deep.equal([{
						credentials:
							accessKeyId: accessKeyId
							secretAccessKey: secret
					}])
					expect(stream).to.equal(@expectedStream)
					done()

			it "accepts byte range", (done) ->
				start = 0
				end = 8
				opts = { start: start, end: end }
				@S3PersistorManager.getFileStream @bucketName, @key, opts, (err, stream) =>
					if err?
						return done(err)
					expect(@s3Client.getObject.lastCall.args).to.deep.equal([{
						Bucket: @bucketName
						Key: @key
						Range: "bytes=#{start}-#{end}"
					}])
					expect(stream).to.equal(@expectedStream)
					done()

		describe "errors", ->
			describe "when the file doesn't exist", ->
				beforeEach ->
					@s3Request.send.callsFake () =>
						@s3EventHandlers.httpHeaders(404, {}, @s3Response, "Not found")

				it "returns a NotFoundError that indicates the bucket and key", (done) ->
					@S3PersistorManager.getFileStream @bucketName, @key, {}, (err, stream) =>
						expect(err).to.be.instanceof(@Errors.NotFoundError)
						errMsg = @Errors.NotFoundError.lastCall.args[0]
						expect(errMsg).to.match(new RegExp(".*#{@bucketName}.*"))
						expect(errMsg).to.match(new RegExp(".*#{@key}.*"))
						done()

			describe "when S3 encounters an unkown error", ->
				beforeEach ->
					@s3Request.send.callsFake () =>
						@s3EventHandlers.httpHeaders(500, {}, @s3Response, "Internal server error")

				it "returns an error", (done) ->
					@S3PersistorManager.getFileStream @bucketName, @key, {}, (err, stream) =>
						expect(err).to.be.instanceof(Error)
						done()

			describe "when the S3 request errors out before receiving HTTP headers", ->
				beforeEach ->
					@s3Request.send.callsFake () =>
						@s3EventHandlers.error(new Error("connection failed"))

				it "returns an error", (done) ->
					@S3PersistorManager.getFileStream @bucketName, @key, {}, (err, stream) =>
						expect(err).to.be.instanceof(Error)
						done()

	describe "getFileSize", ->
		it "should obtain the file size from S3", (done) ->
			expectedFileSize = 123
			@s3Client.headObject.yields(new Error(
				"s3Client.headObject got unexpected arguments"
			))
			@s3Client.headObject.withArgs({
				Bucket: @bucketName
				Key: @key
			}).yields(null, { ContentLength: expectedFileSize })

			@S3PersistorManager.getFileSize @bucketName, @key, (err, fileSize) =>
				if err?
					return done(err)
				expect(fileSize).to.equal(expectedFileSize)
				done()

		[403, 404].forEach (statusCode) ->
			it "should throw NotFoundError when S3 responds with #{statusCode}", (done) ->
				error = new Error()
				error.statusCode = statusCode
				@s3Client.headObject.yields(error)

				@S3PersistorManager.getFileSize @bucketName, @key, (err, fileSize) =>
					expect(err).to.be.an.instanceof(@Errors.NotFoundError)
					done()

		it "should rethrow any other error", (done) ->
			error = new Error()
			@s3Client.headObject.yields(error)
			@s3Client.headObject.yields(error)

			@S3PersistorManager.getFileSize @bucketName, @key, (err, fileSize) =>
				expect(err).to.equal(error)
				done()

	describe "sendFile", ->

		beforeEach ->
			@knoxClient.putFile.returns on:->

		it "should put file with knox", (done)->
			@LocalFileWriter.deleteFile.callsArgWith(1)
			@knoxClient.putFile.callsArgWith(2, @error)
			@S3PersistorManager.sendFile @bucketName, @key, @fsPath, (err)=>
				@knoxClient.putFile.calledWith(@fsPath, @key).should.equal true
				err.should.equal @error
				done()

		it "should delete the file and pass the error with it", (done)->
			@LocalFileWriter.deleteFile.callsArgWith(1)
			@knoxClient.putFile.callsArgWith(2, @error)
			@S3PersistorManager.sendFile @bucketName, @key, @fsPath, (err)=>
				@knoxClient.putFile.calledWith(@fsPath, @key).should.equal true
				err.should.equal @error
				done()

	describe "sendStream", ->
		beforeEach ->
			@fsPath = "to/some/where"
			@origin =
				on:->
			@S3PersistorManager.sendFile = sinon.stub().callsArgWith(3)

		it "should send stream to LocalFileWriter", (done)->
			@LocalFileWriter.deleteFile.callsArgWith(1)
			@LocalFileWriter.writeStream.callsArgWith(2, null, @fsPath)
			@S3PersistorManager.sendStream @bucketName, @key, @origin, =>
				@LocalFileWriter.writeStream.calledWith(@origin).should.equal true
				done()

		it "should return the error from LocalFileWriter", (done)->
			@LocalFileWriter.deleteFile.callsArgWith(1)
			@LocalFileWriter.writeStream.callsArgWith(2, @error)
			@S3PersistorManager.sendStream @bucketName, @key, @origin, (err)=>
				err.should.equal @error
				done()

		it "should send the file to the filestore", (done)->
			@LocalFileWriter.deleteFile.callsArgWith(1)
			@LocalFileWriter.writeStream.callsArgWith(2)
			@S3PersistorManager.sendStream @bucketName, @key, @origin, (err)=>
				@S3PersistorManager.sendFile.called.should.equal true
				done()

	describe "copyFile", ->
		beforeEach ->
			@sourceKey = "my/key"
			@destKey = "my/dest/key"

		it "should use AWS SDK to copy file", (done)->
			@s3Client.copyObject.callsArgWith(1, @error)
			@S3PersistorManager.copyFile @bucketName, @sourceKey, @destKey, (err)=>
				err.should.equal @error
				@s3Client.copyObject.calledWith({Bucket: @bucketName, Key: @destKey, CopySource: @bucketName + '/' + @key}).should.equal true
				done()

		it "should return a NotFoundError object if the original file does not exist", (done)->
			NoSuchKeyError = {code: "NoSuchKey"}
			@s3Client.copyObject.callsArgWith(1, NoSuchKeyError)
			@S3PersistorManager.copyFile @bucketName, @sourceKey, @destKey, (err)=>
				expect(err instanceof @Errors.NotFoundError).to.equal true
				done()

	describe "deleteDirectory", ->

		it "should list the contents passing them onto multi delete", (done)->
			data =
				Contents: [{Key:"1234"}, {Key: "456"}]
			@knoxClient.list.callsArgWith(1, null, data)
			@knoxClient.deleteMultiple.callsArgWith(1)
			@S3PersistorManager.deleteDirectory @bucketName, @key, (err)=>
				@knoxClient.deleteMultiple.calledWith(["1234","456"]).should.equal true
				done()

	describe "deleteFile", ->

		it "should use correct options", (done)->
			@request.callsArgWith(1)

			@S3PersistorManager.deleteFile @bucketName, @key, (err)=>
				opts = @request.args[0][0]
				assert.deepEqual(opts.aws, {key:@settings.filestore.s3.key, secret:@settings.filestore.s3.secret, bucket:@bucketName})
				opts.method.should.equal "delete"
				opts.timeout.should.equal (30*1000)
				opts.uri.should.equal "https://#{@bucketName}.s3.amazonaws.com/#{@key}"
				done()

		it "should return the error", (done)->
			@request.callsArgWith(1, @error)

			@S3PersistorManager.deleteFile @bucketName, @key, (err)=>
				err.should.equal @error
				done()

	describe "checkIfFileExists", ->

		it "should use correct options", (done)->
			@request.callsArgWith(1,  null, statusCode:200)

			@S3PersistorManager.checkIfFileExists @bucketName, @key, (err)=>
				opts = @request.args[0][0]
				assert.deepEqual(opts.aws, {key:@settings.filestore.s3.key, secret:@settings.filestore.s3.secret, bucket:@bucketName})
				opts.method.should.equal "head"
				opts.timeout.should.equal (30*1000)
				opts.uri.should.equal "https://#{@bucketName}.s3.amazonaws.com/#{@key}"
				done()

		it "should return true for a 200", (done)->
			@request.callsArgWith(1, null, statusCode:200)

			@S3PersistorManager.checkIfFileExists @bucketName, @key, (err, exists)=>
				exists.should.equal true
				done()

		it "should return false for a non 200", (done)->
			@request.callsArgWith(1, null, statusCode:404)

			@S3PersistorManager.checkIfFileExists @bucketName, @key, (err, exists)=>
				exists.should.equal false
				done()

		it "should return the error", (done)->
			@request.callsArgWith(1, @error, {})

			@S3PersistorManager.checkIfFileExists @bucketName, @key, (err)=>
				err.should.equal @error
				done()

	describe "directorySize", ->

		it "should sum directory files size", (done) ->
			data =
				Contents: [ {Size: 1024}, {Size: 2048} ]
			@knoxClient.list.callsArgWith(1, null, data)
			@S3PersistorManager.directorySize @bucketName, @key, (err, totalSize)=>
				totalSize.should.equal 3072
				done()
