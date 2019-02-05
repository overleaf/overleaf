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
		@stubbedKnoxClient =
			putFile:sinon.stub()
			copyFile:sinon.stub()
			list: sinon.stub()
			deleteMultiple: sinon.stub()
			get: sinon.stub()
		@knox =
			createClient: sinon.stub().returns(@stubbedKnoxClient)
		@stubbedS3Client =
			copyObject:sinon.stub()
		@awsS3 = sinon.stub().returns @stubbedS3Client
		@LocalFileWriter =
			writeStream: sinon.stub()
			deleteFile: sinon.stub()
		@requires =
			"knox": @knox
			"aws-sdk/clients/s3": @awsS3
			"settings-sharelatex": @settings
			"./LocalFileWriter":@LocalFileWriter
			"logger-sharelatex":
				log:->
				err:->
			"./Errors": @Errors =
				NotFoundError: sinon.stub()
		@key = "my/key"
		@bucketName = "my-bucket"
		@error = "my errror"

	describe "getFileStream", ->
		beforeEach ->
			@S3PersistorManager = SandboxedModule.require modulePath, requires: @requires
			@opts = {}

		it "should use correct key", (done)->
			@stubbedKnoxClient.get.returns(
				on:->
				end:->
			)
			@S3PersistorManager.getFileStream @bucketName, @key, @opts, (err)=> # empty callback
			@stubbedKnoxClient.get.calledWith(@key).should.equal true
			done()

		it "should use default auth", (done)->
			@stubbedKnoxClient.get.returns(
				on:->
				end:->
			)
			@S3PersistorManager.getFileStream @bucketName, @key, @opts, (err)=> # empty callback
			clientParams =
				key: @settings.filestore.s3.key
				secret: @settings.filestore.s3.secret
				bucket: @bucketName
			@knox.createClient.calledWith(clientParams).should.equal true
			done()

		describe "with supplied auth", ->
			beforeEach ->
				@S3PersistorManager = SandboxedModule.require modulePath, requires: @requires
				@credentials =
					auth_key: "that_key"
					auth_secret: "that_secret"
				@opts =
					credentials: @credentials

			it "should use supplied auth", (done)->
				@stubbedKnoxClient.get.returns(
					on:->
					end:->
				)
				@S3PersistorManager.getFileStream @bucketName, @key, @opts, (err)=> # empty callback
				clientParams =
					key: @credentials.auth_key
					secret: @credentials.auth_secret
					bucket: @bucketName
				@knox.createClient.calledWith(clientParams).should.equal true
				done()

		describe "with start and end options", ->
			beforeEach ->
				@opts =
					start: 0
					end: 8
			it "should pass headers to the knox.Client.get()", (done) ->
				@stubbedKnoxClient.get.returns(
					on:->
					end:->
				)
				@S3PersistorManager.getFileStream @bucketName, @key, @opts, (err)=> # empty callback
				@stubbedKnoxClient.get.calledWith(@key, {'Range': 'bytes=0-8'}).should.equal true
				done()

		describe "error conditions", ->

			describe "when the file doesn't exist", ->

				beforeEach ->
					@fakeResponse =
						statusCode: 404
					@stubbedKnoxClient.get.returns(
						on: (key, callback) =>
							if key == 'response'
								callback(@fakeResponse)
						end: ->
					)

				it "should produce a NotFoundError", (done) ->
					@S3PersistorManager.getFileStream @bucketName, @key, @opts, (err, stream)=> # empty callback
						expect(stream).to.equal null
						expect(err).to.not.equal null
						expect(err instanceof @Errors.NotFoundError).to.equal true
						done()

				it "should have bucket and key in the Error message", (done) ->
					@S3PersistorManager.getFileStream @bucketName, @key, @opts, (err, stream)=> # empty callback
						error_message = @Errors.NotFoundError.lastCall.args[0]
						expect(error_message).to.not.equal null
						error_message.should.match(new RegExp(".*#{@bucketName}.*"))
						error_message.should.match(new RegExp(".*#{@key}.*"))
						done()

			describe "when the S3 service produces an error", ->
				beforeEach ->
					@fakeResponse =
						statusCode: 500
					@stubbedKnoxClient.get.returns(
						on: (key, callback) =>
							if key == 'response'
								callback(@fakeResponse)
						end: ->
					)

				it "should produce an error", (done) ->
					@S3PersistorManager.getFileStream @bucketName, @key, @opts, (err, stream)=> # empty callback
						expect(stream).to.equal null
						expect(err).to.not.equal null
						expect(err instanceof Error).to.equal true
						@Errors.NotFoundError.called.should.equal false
						done()

	describe "sendFile", ->

		beforeEach ->
			@S3PersistorManager = SandboxedModule.require modulePath, requires: @requires
			@stubbedKnoxClient.putFile.returns on:->

		it "should put file with knox", (done)->
			@LocalFileWriter.deleteFile.callsArgWith(1)
			@stubbedKnoxClient.putFile.callsArgWith(2, @error)
			@S3PersistorManager.sendFile @bucketName, @key, @fsPath, (err)=>
				@stubbedKnoxClient.putFile.calledWith(@fsPath, @key).should.equal true
				err.should.equal @error
				done()

		it "should delete the file and pass the error with it", (done)->
			@LocalFileWriter.deleteFile.callsArgWith(1)
			@stubbedKnoxClient.putFile.callsArgWith(2, @error)
			@S3PersistorManager.sendFile @bucketName, @key, @fsPath, (err)=>
				@stubbedKnoxClient.putFile.calledWith(@fsPath, @key).should.equal true
				err.should.equal @error
				done()

	describe "sendStream", ->
		beforeEach ->
			@fsPath = "to/some/where"
			@origin =
				on:->
			@S3PersistorManager = SandboxedModule.require modulePath, requires: @requires
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
			@S3PersistorManager = SandboxedModule.require modulePath, requires: @requires

		it "should use AWS SDK to copy file", (done)->
			@stubbedS3Client.copyObject.callsArgWith(1, @error)
			@S3PersistorManager.copyFile @bucketName, @sourceKey, @destKey, (err)=>
				err.should.equal @error
				@stubbedS3Client.copyObject.calledWith({Bucket: @bucketName, Key: @destKey, CopySource: @bucketName + '/' + @key}).should.equal true
				done()

		it "should return a NotFoundError object if the original file does not exist", (done)->
			NoSuchKeyError = {code: "NoSuchKey"}
			@stubbedS3Client.copyObject.callsArgWith(1, NoSuchKeyError)
			@S3PersistorManager.copyFile @bucketName, @sourceKey, @destKey, (err)=>
				expect(err instanceof @Errors.NotFoundError).to.equal true
				done()

	describe "deleteDirectory", ->

		beforeEach ->
			@S3PersistorManager = SandboxedModule.require modulePath, requires: @requires

		it "should list the contents passing them onto multi delete", (done)->
			data =
				Contents: [{Key:"1234"}, {Key: "456"}]
			@stubbedKnoxClient.list.callsArgWith(1, null, data)
			@stubbedKnoxClient.deleteMultiple.callsArgWith(1)
			@S3PersistorManager.deleteDirectory @bucketName, @key, (err)=>
				@stubbedKnoxClient.deleteMultiple.calledWith(["1234","456"]).should.equal true
				done()

	describe "deleteFile", ->

		it "should use correct options", (done)->
			@request = sinon.stub().callsArgWith(1)
			@requires["request"] = @request
			@S3PersistorManager = SandboxedModule.require modulePath, requires: @requires

			@S3PersistorManager.deleteFile @bucketName, @key, (err)=>
				opts = @request.args[0][0]
				assert.deepEqual(opts.aws, {key:@settings.filestore.s3.key, secret:@settings.filestore.s3.secret, bucket:@bucketName})
				opts.method.should.equal "delete"
				opts.timeout.should.equal (30*1000)
				opts.uri.should.equal "https://#{@bucketName}.s3.amazonaws.com/#{@key}"
				done()

		it "should return the error", (done)->
			@request = sinon.stub().callsArgWith(1, @error)
			@requires["request"] = @request
			@S3PersistorManager = SandboxedModule.require modulePath, requires: @requires

			@S3PersistorManager.deleteFile @bucketName, @key, (err)=>
				err.should.equal @error
				done()

	describe "checkIfFileExists", ->

		it "should use correct options", (done)->
			@request = sinon.stub().callsArgWith(1,  null, statusCode:200)
			@requires["request"] = @request
			@S3PersistorManager = SandboxedModule.require modulePath, requires: @requires

			@S3PersistorManager.checkIfFileExists @bucketName, @key, (err)=>
				opts = @request.args[0][0]
				assert.deepEqual(opts.aws, {key:@settings.filestore.s3.key, secret:@settings.filestore.s3.secret, bucket:@bucketName})
				opts.method.should.equal "head"
				opts.timeout.should.equal (30*1000)
				opts.uri.should.equal "https://#{@bucketName}.s3.amazonaws.com/#{@key}"
				done()

		it "should return true for a 200", (done)->
			@request = sinon.stub().callsArgWith(1, null, statusCode:200)
			@requires["request"] = @request
			@S3PersistorManager = SandboxedModule.require modulePath, requires: @requires
			@S3PersistorManager.checkIfFileExists @bucketName, @key, (err, exists)=>
				exists.should.equal true
				done()

		it "should return false for a non 200", (done)->
			@request = sinon.stub().callsArgWith(1, null, statusCode:404)
			@requires["request"] = @request
			@S3PersistorManager = SandboxedModule.require modulePath, requires: @requires
			@S3PersistorManager.checkIfFileExists @bucketName, @key, (err, exists)=>
				exists.should.equal false
				done()

		it "should return the error", (done)->
			@request = sinon.stub().callsArgWith(1, @error, {})
			@requires["request"] = @request
			@S3PersistorManager = SandboxedModule.require modulePath, requires: @requires

			@S3PersistorManager.checkIfFileExists @bucketName, @key, (err)=>
				err.should.equal @error
				done()

	describe "directorySize", ->

		beforeEach ->
			@S3PersistorManager = SandboxedModule.require modulePath, requires: @requires

		it "should sum directory files size", (done) ->
			data =
				Contents: [ {Size: 1024}, {Size: 2048} ]
			@stubbedKnoxClient.list.callsArgWith(1, null, data)
			@S3PersistorManager.directorySize @bucketName, @key, (err, totalSize)=>
				totalSize.should.equal 3072
				done()