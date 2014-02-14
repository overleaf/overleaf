assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../app/js/ImageOptimiser.js"
SandboxedModule = require('sandboxed-module')

describe "ImageOptimiser", ->

	beforeEach ->

		@fs = 
			createReadStream:sinon.stub()
			createWriteStream:sinon.stub()
			rename:sinon.stub()
		@pngcrush = class PngCrush
			pipe:->
			on: ->

		@optimiser = SandboxedModule.require modulePath, requires:
			"fs":@fs
			"pngcrush":@pngcrush
			"logger-sharelatex":
				log:->
				err:->

		@sourcePath = "/this/path/here.eps"
		@writeStream = 
			pipe:->
			on: (type, cb)->
				if type == "finish"
					cb()
		@sourceStream =
			pipe:->
				return pipe:->
			on:->
		@error = "Error"

	describe "compressPng", ->
		
		beforeEach ->
			@fs.createReadStream.returns(@sourceStream)
			@fs.createWriteStream.returns(@writeStream)
			@fs.rename.callsArgWith(2)

		it "should get the file stream", (done)->
			@optimiser.compressPng @sourcePath, (err)=>
				@fs.createReadStream.calledWith(@sourcePath).should.equal true
				done()

		it "should create a compressed file stream", (done)->
			@optimiser.compressPng @sourcePath, (err)=>
				@fs.createWriteStream.calledWith("#{@sourcePath}-optimised")
				done()

		it "should rename the file after completion", (done)->
			@optimiser.compressPng @sourcePath, (err)=>
				@fs.rename.calledWith("#{@sourcePath}-optimised", @sourcePath).should.equal true
				done()