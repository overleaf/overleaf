assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../app/js/FileConverter.js"
SandboxedModule = require('sandboxed-module')

describe "FileConverter", ->

	beforeEach ->

		@child_process =
			exec : sinon.stub()
		@converter = SandboxedModule.require modulePath, requires:
			'child_process': @child_process
			"logger-sharelatex":
				log:->
				err:->

		@sourcePath = "/this/path/here.eps"
		@format = "png"
		@error = "Error"

	describe "convert", ->

		it "should convert the source to the requested format", (done)->
			@child_process.exec.callsArgWith(2)
			@converter.convert @sourcePath, @format, (err)=>
				args = @child_process.exec.args[0][0]
				args.indexOf(@sourcePath).should.not.equal -1 
				args.indexOf(@format).should.not.equal -1 
				done()

		it "should return the dest path", (done)->
			@child_process.exec.callsArgWith(2)
			@converter.convert @sourcePath, @format, (err, destPath)=>
				destPath.should.equal "#{@sourcePath}.#{@format}"
				done()

		it "should return the error from convert", (done)->
			@child_process.exec.callsArgWith(2, @error)
			@converter.convert @sourcePath, @format, (err)=>
				err.should.equal @error
				done()

		it "should not accapt an non aproved format", (done)->
			@child_process.exec.callsArgWith(2)
			@converter.convert @sourcePath, "ahhhhh", (err)=>
				expect(err).to.exist
				done()

	describe "thumbnail", ->
		it "should call converter resize with args", (done)->
			@child_process.exec.callsArgWith(2)
			@converter.thumbnail @sourcePath, (err)=>
				args = @child_process.exec.args[0][0]
				args.indexOf(@sourcePath).should.not.equal -1 
				done()

	describe "preview", ->
		it "should call converter resize with args", (done)->
			@child_process.exec.callsArgWith(2)
			@converter.preview @sourcePath, (err)=>
				args = @child_process.exec.args[0][0]
				args.indexOf(@sourcePath).should.not.equal -1 
				done()
