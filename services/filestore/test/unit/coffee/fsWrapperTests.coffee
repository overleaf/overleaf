logger = require("logger-sharelatex")
assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../app/js/fsWrapper.js"
SandboxedModule = require('sandboxed-module')


describe "fsWrapperTests", ->

	beforeEach ->
		@s3Wrapper =
			getFileStream: sinon.stub()
			checkIfFileExists: sinon.stub()
			deleteFile: sinon.stub()
			deleteDirectory: sinon.stub()
			sendStreamToS3: sinon.stub()
			insertFile: sinon.stub()

	describe "test s3 mixin", ->
		beforeEach ->
			@settings =
				filestoreBackend: "s3"
			@requires =
				"./s3Wrapper": @s3Wrapper
				"settings-sharelatex": @settings
				"logger-sharelatex":
					log:->
					err:->
			@fsWrapper = SandboxedModule.require modulePath, requires: @requires

		it "should load getFileStream", (done) ->
			@fsWrapper.should.respondTo("getFileStream")
			@fsWrapper.getFileStream()
			@s3Wrapper.getFileStream.calledOnce.should.equal true
			done()

		it "should load checkIfFileExists", (done) ->
			@fsWrapper.checkIfFileExists()
			@s3Wrapper.checkIfFileExists.calledOnce.should.equal true
			done()

		it "should load deleteFile", (done) ->
			@fsWrapper.deleteFile()
			@s3Wrapper.deleteFile.calledOnce.should.equal true
			done()

		it "should load deleteDirectory", (done) ->
			@fsWrapper.deleteDirectory()
			@s3Wrapper.deleteDirectory.calledOnce.should.equal true
			done()

		it "should load sendStreamToS3", (done) ->
			@fsWrapper.sendStreamToS3()
			@s3Wrapper.sendStreamToS3.calledOnce.should.equal true
			done()

		it "should load insertFile", (done) ->
			@fsWrapper.insertFile()
			@s3Wrapper.insertFile.calledOnce.should.equal true
			done()

	describe "test invalid mixins", ->

		it "should not load a null wrapper", (done) ->
			@settings =
			@requires =
				"./s3Wrapper": @s3Wrapper
				"settings-sharelatex": @settings
				"logger-sharelatex":
					log:->
					err:->
			try
				@fsWrapper=SandboxedModule.require modulePath, requires: @requires
			catch error
				assert.equal("Unknown filestore backend: null",error.message)
			done()

		it "should not load an invalid wrapper", (done) ->
			@settings =
				filestoreBackend:"magic"
			@requires =
				"./s3Wrapper": @s3Wrapper
				"settings-sharelatex": @settings
				"logger-sharelatex":
					log:->
					err:->
			try
				@fsWrapper=SandboxedModule.require modulePath, requires: @requires
			catch error
				assert.equal("Unknown filestore backend: magic",error.message)
			done()


