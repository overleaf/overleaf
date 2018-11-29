
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
		@fs = 
			createWriteStream : sinon.stub().returns(@writeStream)
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
			"metrics-sharelatex": 
				inc:->
				Timer:->
					done:->

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

	describe "delete file", ->

		it "should unlink the file", (done)->
			error = "my error"
			@fs.unlink.callsArgWith(1, error)
			@writer.deleteFile @stubbedFsPath, (err)=>
				@fs.unlink.calledWith(@stubbedFsPath).should.equal true
				err.should.equal error
				done()

