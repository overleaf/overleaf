assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../app/js/FileController.js"
SandboxedModule = require('sandboxed-module')

describe "FileController", ->

	beforeEach ->
		@PersistorManager =
			sendStream: sinon.stub()
			copyFile: sinon.stub()
			deleteFile:sinon.stub()

		@settings =
			s3:
				buckets:
					user_files:"user_files"
		@FileHandler =
			getFile: sinon.stub()
			deleteFile: sinon.stub()
			insertFile: sinon.stub()
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
			key:@key
			bucket:@bucket
			query:{}
			params:
				project_id:@project_id
				file_id:@file_id
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

		it "should send a 200 if the cacheWarm param is true", (done)->
			@req.query.cacheWarm = true
			@FileHandler.getFile.callsArgWith(3, null, @fileStream)
			@res.send = (statusCode)=>
				statusCode.should.equal 200
				done()
			@controller.getFile @req, @res

		it "should send a 500 if there is a problem", (done)->
			@FileHandler.getFile.callsArgWith(3, "error")
			@res.send = (code)=>
				code.should.equal 500
				done()
			@controller.getFile @req, @res

	describe "insertFile", ->

		it "should send bucket name key and res to PersistorManager", (done)->
			@FileHandler.insertFile.callsArgWith(3)
			@res.send = =>
				@FileHandler.insertFile.calledWith(@bucket, @key, @req).should.equal true
				done()
			@controller.insertFile @req, @res

	describe "copyFile", ->
		beforeEach ->
			@oldFile_id = "old_file_id"
			@oldProject_id = "old_project_id"
			@req.body =
				source:
					project_id: @oldProject_id
					file_id: @oldFile_id

		it "should send bucket name and both keys to PersistorManager", (done)->
			@PersistorManager.copyFile.callsArgWith(3)
			@res.send = (code)=>
				code.should.equal 200
				@PersistorManager.copyFile.calledWith(@bucket, "#{@oldProject_id}/#{@oldFile_id}", @key).should.equal true
				done()
			@controller.copyFile @req, @res

		it "should send a 500 if there was an error", (done)->
			@PersistorManager.copyFile.callsArgWith(3, "error")
			@res.send = (code)=>
				code.should.equal 500
				done()
			@controller.copyFile @req, @res	

	describe "delete file", ->

		it "should tell the file handler", (done)->
			@FileHandler.deleteFile.callsArgWith(2)
			@res.send = (code)=>
				code.should.equal 204
				@FileHandler.deleteFile.calledWith(@bucket, @key).should.equal true
				done()
			@controller.deleteFile @req, @res

		it "should send a 500 if there was an error", (done)->
			@FileHandler.deleteFile.callsArgWith(2, "error")
			@res.send = (code)->
				code.should.equal 500
				done()
			@controller.deleteFile @req, @res
