assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../app/js/FileConverter.js"
SandboxedModule = require('sandboxed-module')

describe "FileConverter", ->

	beforeEach ->

		@safe_exec = sinon.stub()
		@converter = SandboxedModule.require modulePath, requires:
			"./SafeExec": @safe_exec
			"logger-sharelatex":
				log:->
				err:->
			"metrics-sharelatex": 
				inc:->
				Timer:->
					done:->
			"settings-sharelatex": @Settings =
				commands:
					convertCommandPrefix: []

		@sourcePath = "/this/path/here.eps"
		@format = "png"
		@error = "Error"

	describe "convert", ->

		it "should convert the source to the requested format", (done)->
			@safe_exec.callsArgWith(2)
			@converter.convert @sourcePath, @format, (err)=>
				args = @safe_exec.args[0][0]
				args.indexOf("#{@sourcePath}[0]").should.not.equal -1 
				args.indexOf("#{@sourcePath}.#{@format}").should.not.equal -1 
				done()

		it "should return the dest path", (done)->
			@safe_exec.callsArgWith(2)
			@converter.convert @sourcePath, @format, (err, destPath)=>
				destPath.should.equal "#{@sourcePath}.#{@format}"
				done()

		it "should return the error from convert", (done)->
			@safe_exec.callsArgWith(2, @error)
			@converter.convert @sourcePath, @format, (err)=>
				err.should.equal @error
				done()

		it "should not accapt an non aproved format", (done)->
			@safe_exec.callsArgWith(2)
			@converter.convert @sourcePath, "ahhhhh", (err)=>
				expect(err).to.exist
				done()
		
		it "should prefix the command with Settings.commands.convertCommandPrefix", (done) ->
			@safe_exec.callsArgWith(2)
			@Settings.commands.convertCommandPrefix = ["nice"]
			@converter.convert @sourcePath, @format, (err)=>
				command = @safe_exec.args[0][0]
				command[0].should.equal "nice"
				done()

	describe "thumbnail", ->
		it "should call converter resize with args", (done)->
			@safe_exec.callsArgWith(2)
			@converter.thumbnail @sourcePath, (err)=>
				args = @safe_exec.args[0][0]
				args.indexOf("#{@sourcePath}[0]").should.not.equal -1 
				done()

	describe "preview", ->
		it "should call converter resize with args", (done)->
			@safe_exec.callsArgWith(2)
			@converter.preview @sourcePath, (err)=>
				args = @safe_exec.args[0][0]
				args.indexOf("#{@sourcePath}[0]").should.not.equal -1 
				done()
