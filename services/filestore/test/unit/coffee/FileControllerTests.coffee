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
			getDirectorySize: sinon.stub()
		@LocalFileWriter = {}
		@controller = SandboxedModule.require modulePath, requires:
			"./LocalFileWriter":@LocalFileWriter
			"./FileHandler": @FileHandler
			"./PersistorManager":@PersistorManager
			"./Errors": @Errors =
				NotFoundError: sinon.stub()
			"settings-sharelatex": @settings
			"metrics-sharelatex": 
				inc:->
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

		describe "with a 'Range' header set", ->

			beforeEach ->
				@req.headers.range = 'bytes=0-8'

			it "should pass 'start' and 'end' options to FileHandler", (done) ->
				@FileHandler.getFile.callsArgWith(3, null, @fileStream)
				@fileStream.pipe = (res)=>
					expect(@FileHandler.getFile.lastCall.args[2].start).to.equal 0
					expect(@FileHandler.getFile.lastCall.args[2].end).to.equal 8
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

		it "should send a 404 if the original file was not found", (done) ->
			@PersistorManager.copyFile.callsArgWith(3, new @Errors.NotFoundError())
			@res.send = (code)=>
				code.should.equal 404
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

	describe "_get_range", ->

		it "should parse a valid Range header", (done) ->
			result = @controller._get_range('bytes=0-200')
			expect(result).to.not.equal null
			expect(result.start).to.equal 0
			expect(result.end).to.equal 200
			done()

		it "should return null for an invalid Range header", (done) ->
			result = @controller._get_range('wat')
			expect(result).to.equal null
			done()

		it "should return null for any type other than 'bytes'", (done) ->
			result = @controller._get_range('carrots=0-200')
			expect(result).to.equal null
			done()

	describe "directorySize", ->

		it "should return total directory size bytes", (done) ->
			@FileHandler.getDirectorySize.callsArgWith(2, null, 1024)
			@controller.directorySize @req, json:(result)=>
				expect(result['total bytes']).to.equal 1024
				done()

		it "should send a 500 if there was an error", (done)->
			@FileHandler.getDirectorySize.callsArgWith(2, "error")
			@res.send = (code)->
				code.should.equal 500
				done()
			@controller.directorySize @req, @res
