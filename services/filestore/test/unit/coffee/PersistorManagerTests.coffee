logger = require("logger-sharelatex")
assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../app/js/PersistorManager.js"
SandboxedModule = require('sandboxed-module')


describe "PersistorManagerTests", ->

	beforeEach ->
		@S3PersistorManager =
			getFileStream: sinon.stub()
			checkIfFileExists: sinon.stub()
			deleteFile: sinon.stub()
			deleteDirectory: sinon.stub()
			sendStream: sinon.stub()
			insertFile: sinon.stub()

	describe "test s3 mixin", ->
		beforeEach ->
			@settings =
				filestore:
					backend: "s3"
			@requires =
				"./S3PersistorManager": @S3PersistorManager
				"settings-sharelatex": @settings
				"logger-sharelatex":
					log:->
					err:->
			@PersistorManager = SandboxedModule.require modulePath, requires: @requires

		it "should load getFileStream", (done) ->
			@PersistorManager.should.respondTo("getFileStream")
			@PersistorManager.getFileStream()
			@S3PersistorManager.getFileStream.calledOnce.should.equal true
			done()

		it "should load checkIfFileExists", (done) ->
			@PersistorManager.checkIfFileExists()
			@S3PersistorManager.checkIfFileExists.calledOnce.should.equal true
			done()

		it "should load deleteFile", (done) ->
			@PersistorManager.deleteFile()
			@S3PersistorManager.deleteFile.calledOnce.should.equal true
			done()

		it "should load deleteDirectory", (done) ->
			@PersistorManager.deleteDirectory()
			@S3PersistorManager.deleteDirectory.calledOnce.should.equal true
			done()

		it "should load sendStream", (done) ->
			@PersistorManager.sendStream()
			@S3PersistorManager.sendStream.calledOnce.should.equal true
			done()

		it "should load insertFile", (done) ->
			@PersistorManager.insertFile()
			@S3PersistorManager.insertFile.calledOnce.should.equal true
			done()

	describe "test unspecified mixins", ->

		it "should load s3 when no wrapper specified", (done) ->
			@settings = {filestore:{}}
			@requires =
				"./S3PersistorManager": @S3PersistorManager
				"settings-sharelatex": @settings
				"logger-sharelatex":
					log:->
					err:->
			@PersistorManager = SandboxedModule.require modulePath, requires: @requires
			@PersistorManager.should.respondTo("getFileStream")
			@PersistorManager.getFileStream()
			@S3PersistorManager.getFileStream.calledOnce.should.equal true
			done()

	describe "test invalid mixins", ->
		it "should not load an invalid wrapper", (done) ->
			@settings =
				filestore:
					backend:"magic"
			@requires =
				"./S3PersistorManager": @S3PersistorManager
				"settings-sharelatex": @settings
				"logger-sharelatex":
					log:->
					err:->
			@fsWrapper=null
			try
				@PersistorManager=SandboxedModule.require modulePath, requires: @requires
			catch error
				assert.equal("Unknown filestore backend: magic",error.message)
			assert.isNull(@fsWrapper)
			done()


