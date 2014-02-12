SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../app/js/CompileManager'
tk = require("timekeeper")

describe "CompileManager", ->
	beforeEach ->
		@CompileManager = SandboxedModule.require modulePath, requires:
			"./LatexRunner": @LatexRunner = {}
			"./ResourceWriter": @ResourceWriter = {}
			"./OutputFileFinder": @OutputFileFinder = {}
			"settings-sharelatex": @Settings = { path: compilesDir: "/compiles/dir" }
			"logger-sharelatex": @logger = { log: sinon.stub() }
			"rimraf": @rimraf = sinon.stub().callsArg(1)
		@callback = sinon.stub()

	describe "doCompile", ->
		beforeEach ->
			@output_files = [{
				path: "output.log"
				type: "log"
			}, {
				path: "output.pdf"
				type: "pdf"
			}]
			@request =
				resources: @resources = "mock-resources"
				rootResourcePath: @rootResourcePath = "main.tex"
				project_id: @project_id = "project-id-123"
				compiler: @compiler = "pdflatex"
				timeout: @timeout = 42000
			@Settings.compileDir = "compiles"
			@compileDir = "#{@Settings.path.compilesDir}/#{@project_id}"
			@ResourceWriter.syncResourcesToDisk = sinon.stub().callsArg(3)
			@LatexRunner.runLatex = sinon.stub().callsArg(2)
			@OutputFileFinder.findOutputFiles = sinon.stub().callsArgWith(2, null, @output_files)
			@CompileManager.doCompile @request, @callback

		it "should write the resources to disk", ->
			@ResourceWriter.syncResourcesToDisk
				.calledWith(@project_id, @resources, @compileDir)
				.should.equal true

		it "should run LaTeX", ->
			@LatexRunner.runLatex
				.calledWith(@project_id, {
					directory: @compileDir
					mainFile:  @rootResourcePath
					compiler:  @compiler
					timeout:   @timeout
				})
				.should.equal true

		it "should find the output files", ->
			@OutputFileFinder.findOutputFiles
				.calledWith(@resources, @compileDir)
				.should.equal true

		it "should return the output files", ->
			@callback.calledWith(null, @output_files).should.equal true

	describe "clearProject", ->
		beforeEach ->
			@Settings.compileDir = "compiles"
			@CompileManager.clearProject @project_id, @callback

		it "should remove the project directory", ->
			@rimraf.calledWith("#{@Settings.compileDir}/#{@project_id}")
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true
