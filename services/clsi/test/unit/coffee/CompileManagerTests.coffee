SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../app/js/CompileManager'
tk = require("timekeeper")
EventEmitter = require("events").EventEmitter
Path = require "path"

describe "CompileManager", ->
	beforeEach ->
		@CompileManager = SandboxedModule.require modulePath, requires:
			"./LatexRunner": @LatexRunner = {}
			"./ResourceWriter": @ResourceWriter = {}
			"./OutputFileFinder": @OutputFileFinder = {}
			"settings-sharelatex": @Settings = { path: compilesDir: "/compiles/dir" }
			"logger-sharelatex": @logger = { log: sinon.stub() }
			"child_process": @child_process = {}
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
		describe "succesfully", ->
			beforeEach ->
				@Settings.compileDir = "compiles"
				@proc = new EventEmitter()
				@proc.stdout = new EventEmitter()
				@proc.stderr = new EventEmitter()
				@child_process.spawn = sinon.stub().returns(@proc)
				@CompileManager.clearProject @project_id, @callback
				@proc.emit "close", 0

			it "should remove the project directory", ->
				@child_process.spawn
					.calledWith("rm", ["-r", "#{@Settings.path.compilesDir}/#{@project_id}"])
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "with a non-success status code", ->
			beforeEach ->
				@Settings.compileDir = "compiles"
				@proc = new EventEmitter()
				@proc.stdout = new EventEmitter()
				@proc.stderr = new EventEmitter()
				@child_process.spawn = sinon.stub().returns(@proc)
				@CompileManager.clearProject @project_id, @callback
				@proc.stderr.emit "data", @error = "oops"
				@proc.emit "close", 1

			it "should remove the project directory", ->
				@child_process.spawn
					.calledWith("rm", ["-r", "#{@Settings.path.compilesDir}/#{@project_id}"])
					.should.equal true

			it "should call the callback with an error from the stderr", ->
				@callback
					.calledWith(new Error())
					.should.equal true

				@callback.args[0][0].message.should.equal "rm -r #{@Settings.path.compilesDir}/#{@project_id} failed: #{@error}"

	describe "syncing", ->
		beforeEach ->
			@page = 1
			@h = 42.23
			@v = 87.56
			@width = 100.01
			@height = 234.56
			@line = 5
			@column = 3
			@file_name = "main.tex"
			@child_process.execFile = sinon.stub()
			@Settings.path.synctexBaseDir = (project_id) => "#{@Settings.path.compilesDir}/#{@project_id}"

		describe "syncFromCode", ->
			beforeEach ->
				@child_process.execFile.callsArgWith(3, null, @stdout = "NODE\t#{@page}\t#{@h}\t#{@v}\t#{@width}\t#{@height}\n", "")
				@CompileManager.syncFromCode @project_id, @file_name, @line, @column, @callback

			it "should execute the synctex binary", ->
				bin_path = Path.resolve(__dirname + "/../../../bin/synctex")
				synctex_path = "#{@Settings.path.compilesDir}/#{@project_id}/output.pdf"
				file_path = "#{@Settings.path.compilesDir}/#{@project_id}/#{@file_name}"
				@child_process.execFile
					.calledWith(bin_path, ["code", synctex_path, file_path, @line, @column], timeout: 10000)
					.should.equal true

			it "should call the callback with the parsed output", ->
				@callback
					.calledWith(null, [{
						page: @page
						h: @h
						v: @v
						height: @height
						width: @width
					}])
					.should.equal true

		describe "syncFromPdf", ->
			beforeEach ->
				@child_process.execFile.callsArgWith(3, null, @stdout = "NODE\t#{@Settings.path.compilesDir}/#{@project_id}/#{@file_name}\t#{@line}\t#{@column}\n", "")
				@CompileManager.syncFromPdf @project_id, @page, @h, @v, @callback

			it "should execute the synctex binary", ->
				bin_path = Path.resolve(__dirname + "/../../../bin/synctex")
				synctex_path = "#{@Settings.path.compilesDir}/#{@project_id}/output.pdf"
				@child_process.execFile
					.calledWith(bin_path, ["pdf", synctex_path, @page, @h, @v], timeout: 10000)
					.should.equal true

			it "should call the callback with the parsed output", ->
				@callback
					.calledWith(null, [{
						file: @file_name
						line: @line
						column: @column
					}])
					.should.equal true