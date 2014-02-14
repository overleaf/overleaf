assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../app/js/FileConverter.js"
SandboxedModule = require('sandboxed-module')

describe "FileConverter", ->

	beforeEach ->

		@easyimage = 
			convert:sinon.stub()
			exec: sinon.stub()
		@converter = SandboxedModule.require modulePath, requires:
			"easyimage":@easyimage
			"logger-sharelatex":
				log:->
				err:->

		@sourcePath = "/this/path/here.eps"
		@format = "png"
		@error = "Error"

	describe "convert", ->

		it "should convert the source to the requested format", (done)->
			@easyimage.convert.callsArgWith(1)
			@converter.convert @sourcePath, @format, (err)=>
				args = @easyimage.convert.args[0][0]
				args.src.should.equal @sourcePath+"[0]"
				args.dst.should.equal "#{@sourcePath}.#{@format}"
				done()


		it "should return the dest path", (done)->
			@easyimage.convert.callsArgWith(1)
			@converter.convert @sourcePath, @format, (err, destPath)=>
				destPath.should.equal "#{@sourcePath}.#{@format}"
				done()

		it "should return the error from convert", (done)->
			@easyimage.convert.callsArgWith(1, @error)
			@converter.convert @sourcePath, @format, (err)=>
				err.should.equal @error
				done()

		it "should not accapt an non aproved format", (done)->
			@easyimage.convert.callsArgWith(1)
			@converter.convert @sourcePath, "ahhhhh", (err)=>
				expect(err).to.exist
				done()


	describe "thumbnail", ->
		it "should call easy image resize with args", (done)->
			@easyimage.exec.callsArgWith(1)
			@converter.thumbnail @sourcePath, (err)=>
				args = @easyimage.exec.args[0][0]
				args.indexOf(@sourcePath).should.not.equal -1 
				done()

		it "should compress the png", ()->


	describe "preview", ->
		it "should call easy image resize with args", (done)->
			@easyimage.exec.callsArgWith(1)
			@converter.preview @sourcePath, (err)=>
				args = @easyimage.exec.args[0][0]
				args.indexOf(@sourcePath).should.not.equal -1 
				done()
