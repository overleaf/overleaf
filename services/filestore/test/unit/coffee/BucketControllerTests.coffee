assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../app/js/BucketController.js"
SandboxedModule = require('sandboxed-module')

describe "BucketController", ->

	beforeEach ->
		@PersistorManager =
			sendStream: sinon.stub()
			copyFile: sinon.stub()
			deleteFile:sinon.stub()

		@settings =
			s3:
				buckets:
					user_files:"user_files"
			filestore:
				backend: "s3"
				s3:
					secret: "secret"
					key: "this_key"

		@FileHandler =
			getFile: sinon.stub()
			deleteFile: sinon.stub()
			insertFile: sinon.stub()
			getDirectorySize: sinon.stub()
		@LocalFileWriter = {}
		@controller = SandboxedModule.require modulePath, requires:
			"./LocalFileWriter":@LocalFileWriter
			"./FileHandler": @FileHandler
			"./PersistorManager":@PersistorManager
			"settings-sharelatex": @settings
			"logger-sharelatex":
				log:->
				err:->
		@project_id = "project_id"
		@file_id = "file_id"
		@bucket = "user_files"
		@key = "#{@project_id}/#{@file_id}"
		@req =
			query:{}
			params:
				bucket: @bucket
				0: @key
			headers: {}
		@res =
			setHeader: ->
		@fileStream = {}

	describe "getFile", ->

		it "should pipe the stream", (done)->
			@FileHandler.getFile.callsArgWith(3, null, @fileStream)
			@fileStream.pipe = (res)=>
				res.should.equal @res
				done()
			@controller.getFile @req, @res

		it "should send a 500 if there is a problem", (done)->
			@FileHandler.getFile.callsArgWith(3, "error")
			@res.send = (code)=>
				code.should.equal 500
				done()
			@controller.getFile @req, @res
