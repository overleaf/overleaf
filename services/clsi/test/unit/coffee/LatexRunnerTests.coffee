SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../app/js/LatexRunner'
Path = require "path"

describe "LatexRunner", ->
	beforeEach ->
		@LatexRunner = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @Settings =
				docker:
					socketPath: "/var/run/docker.sock"
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
			"./Metrics":
				Timer: class Timer
					done: () ->
			"./CommandRunner": @CommandRunner = {}

		@directory = "/local/compile/directory"
		@mainFile  = "main-file.tex"
		@compiler  = "pdflatex"
		@image     = "example.com/image"
		@callback  = sinon.stub()
		@project_id = "project-id-123"
		@env       = {'foo': '123'}

	describe "runLatex", ->
		beforeEach ->
			@CommandRunner.run = sinon.stub().callsArg(6)

		describe "normally", ->
			beforeEach ->
				@LatexRunner.runLatex @project_id,
					directory: @directory
					mainFile:  @mainFile
					compiler:  @compiler
					timeout:   @timeout = 42000
					image:     @image
					environment: @env
					@callback

			it "should run the latex command", ->
				@CommandRunner.run
					.calledWith(@project_id, sinon.match.any, @directory, @image, @timeout, @env)
					.should.equal true

		describe "with an .Rtex main file", ->
			beforeEach ->
				@LatexRunner.runLatex @project_id,
					directory: @directory
					mainFile:  "main-file.Rtex"
					compiler:  @compiler
					image:     @image
					timeout:   @timeout = 42000
					@callback

			it "should run the latex command on the equivalent .tex file", ->
				command = @CommandRunner.run.args[0][1]
				mainFile = command.slice(-1)[0]
				mainFile.should.equal "$COMPILE_DIR/main-file.tex"

		describe "with a flags option", ->
			beforeEach ->
				@LatexRunner.runLatex @project_id,
					directory: @directory
					mainFile:  @mainFile
					compiler:  @compiler
					image:     @image
					timeout:   @timeout = 42000
					flags:     ["-file-line-error", "-halt-on-error"]
					@callback

			it "should include the flags in the command", ->
				command = @CommandRunner.run.args[0][1]
				flags = command.filter (arg) ->
					(arg == "-file-line-error") || (arg == "-halt-on-error")
				flags.length.should.equal 2
				flags[0].should.equal "-file-line-error"
				flags[1].should.equal "-halt-on-error"
