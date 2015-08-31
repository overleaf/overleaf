
assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../app/js/LocalFileWriter.js"
SandboxedModule = require('sandboxed-module')
fs = require("fs")
request = require("request")
settings = require("settings-sharelatex")

describe "Filestore", ->

	before (done)->
		@localFileReadPath = "/tmp/filestore_acceptence_tests_file_read.txt"
		@localFileWritePath = "/tmp/filestore_acceptence_tests_file_write.txt"

		@constantFileContent = [
			"hello world"
			"line 2 goes here #{Math.random()}"
			"there are 3 lines in all"
		].join("\n")

		fs.writeFile(@localFileReadPath, @constantFileContent, done)
		@filestoreUrl = "http://localhost:#{settings.internal.filestore.port}"

	beforeEach (done)->
		fs.unlink @localFileWritePath, =>
			done()



	it "should send a 200 for status endpoing", (done)->
		request "#{@filestoreUrl}/status", (err, response, body)->
			response.statusCode.should.equal 200
			body.indexOf("filestore").should.not.equal -1
			body.indexOf("up").should.not.equal -1
			done()

	describe "with a file on the server", ->

		beforeEach (done)->
			@timeout(1000 * 10)
			@file_id = Math.random()
			@fileUrl = "#{@filestoreUrl}/project/acceptence_tests/file/#{@file_id}"

			writeStream = request.post(@fileUrl)

			writeStream.on "end", done
			fs.createReadStream(@localFileReadPath).pipe writeStream

		it "should return 404 for a non-existant id", (done) ->
			@timeout(1000 * 20)
			options =
				uri: @fileUrl + '___this_is_clearly_wrong___'
			request.get options, (err, response, body) =>
				response.statusCode.should.equal 404
				done()

		it "should be able get the file back", (done)->
			@timeout(1000 * 10)
			request.get @fileUrl, (err, response, body)=>
				body.should.equal @constantFileContent
				done()

		it "should be able to get back the first 8 bytes of the file", (done) ->
			@timeout(1000 * 10)
			options =
				uri: @fileUrl
				headers:
					'Range': 'bytes=0-8'
			request.get options, (err, response, body)=>
				body.should.equal 'hello wor'
				done()

		it "should be able to get back bytes 4 through 10 of the file", (done) ->
			@timeout(1000 * 10)
			options =
				uri: @fileUrl
				headers:
					'Range': 'bytes=4-10'
			request.get options, (err, response, body)=>
				body.should.equal 'o world'
				done()

		it "should be able to delete the file", (done)->
			@timeout(1000 * 20)
			request.del @fileUrl, (err, response, body)=>
				response.statusCode.should.equal 204
				request.get @fileUrl, (err, response, body)=>
					response.statusCode.should.equal 404
					done()

		it "should be able to copy files", (done)->
			@timeout(1000 * 20)

			newProjectID = "acceptence_tests_copyied_project"
			newFileId = Math.random()
			newFileUrl = "#{@filestoreUrl}/project/#{newProjectID}/file/#{newFileId}"
			opts =
				method: 'put'
				uri: newFileUrl
				json:
					source:
						project_id:"acceptence_tests"
						file_id: @file_id
			request opts, (err, response, body)=>
				response.statusCode.should.equal 200
				request.del @fileUrl, (err, response, body)=>
					response.statusCode.should.equal 204
					request.get newFileUrl, (err, response, body)=>
						body.should.equal @constantFileContent
						done()
