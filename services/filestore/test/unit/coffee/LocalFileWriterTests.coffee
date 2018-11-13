
assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../app/js/LocalFileWriter.js"
SandboxedModule = require('sandboxed-module')

describe "LocalFileWriter", ->

	beforeEach ->

		@writeStream = 
			on: (type, cb)->
				if type == "finish"
					cb()
		@readStream = 
			on: ->
		@fs = 
			createWriteStream : sinon.stub().returns(@writeStream)
			createReadStream: sinon.stub().returns(@readStream)
			unlink: sinon.stub()
		@settings =
			path:
				uploadFolder:"somewhere"
		@writer = SandboxedModule.require modulePath, requires:
			"fs": @fs
			"logger-sharelatex":
				log:->
				err:->
			"settings-sharelatex":@settings
		@stubbedFsPath = "something/uploads/eio2k1j3"

	describe "writeStrem", ->
		beforeEach ->
			@writer._getPath = sinon.stub().returns(@stubbedFsPath)

		it "write the stream to ./uploads", (done)->
			stream = 
				pipe: (dest)=>
					dest.should.equal @writeStream
					done()
				on: ->
			@writer.writeStream stream, null, ()=>

		it "should send the path in the callback", (done)->
			stream = 
				pipe: (dest)=>
				on: (type, cb)->
					if type == "end"
						cb()
			@writer.writeStream stream, null, (err, fsPath)=>
				fsPath.should.equal @stubbedFsPath
				done()

	describe "getStream", ->

		it "should read the stream from the file ", (done)->
			@writer.getStream @stubbedFsPath, (err, stream)=>
				@fs.createReadStream.calledWith(@stubbedFsPath).should.equal true
				done()

		it "should send the stream in the callback", (done)->
			@writer.getStream @stubbedFsPath, (err, readStream)=>
				readStream.should.equal @readStream
				done()

	describe "delete file", ->

		it "should unlink the file", (done)->
			error = "my error"
			@fs.unlink.callsArgWith(1, error)
			@writer.deleteFile @stubbedFsPath, (err)=>
				@fs.unlink.calledWith(@stubbedFsPath).should.equal true
				err.should.equal error
				done()

