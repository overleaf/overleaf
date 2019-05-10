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
			"./OutputCacheManager": @OutputCacheManager = {}
			"settings-sharelatex": @Settings =
				path:
					compilesDir: "/compiles/dir"
				synctexBaseDir: -> "/compile"
				clsi:
					docker:
						image: "SOMEIMAGE"

			"logger-sharelatex": @logger = { log: sinon.stub() , info:->}
			"child_process": @child_process = {}
			"./CommandRunner": @CommandRunner = {}
			"./DraftModeManager": @DraftModeManager = {}
			"./TikzManager": @TikzManager = {}
			"./LockManager": @LockManager = {}
			"fs": @fs = {}
			"fs-extra": @fse = { ensureDir: sinon.stub().callsArg(1) }
		@callback = sinon.stub()
		@project_id = "project-id-123"
		@user_id = "1234"
	describe "doCompileWithLock", ->
		beforeEach ->
			@request =
				resources: @resources = "mock-resources"
				project_id: @project_id
				user_id: @user_id
			@output_files = ["foo", "bar"]
			@Settings.compileDir = "compiles"
			@compileDir = "#{@Settings.path.compilesDir}/#{@project_id}-#{@user_id}"
			@CompileManager.doCompile = sinon.stub().callsArgWith(1, null, @output_files)
			@LockManager.runWithLock = (lockFile, runner, callback) ->
				runner (err, result...) ->
					callback(err, result...)

		describe "when the project is not locked", ->
			beforeEach ->
				@CompileManager.doCompileWithLock @request, @callback

			it "should ensure that the compile directory exists", ->
				@fse.ensureDir.calledWith(@compileDir)
				.should.equal true

			it "should call doCompile with the request", ->
				@CompileManager.doCompile
				.calledWith(@request)
				.should.equal true

			it "should call the callback with the output files", ->
				@callback.calledWithExactly(null, @output_files)
				.should.equal true

		describe "when the project is locked", ->
			beforeEach ->
				@error = new Error("locked")
				@LockManager.runWithLock = (lockFile, runner, callback) =>
					callback(@error)
				@CompileManager.doCompileWithLock @request, @callback

			it "should ensure that the compile directory exists", ->
				@fse.ensureDir.calledWith(@compileDir)
				.should.equal true

			it "should not call doCompile with the request", ->
				@CompileManager.doCompile
				.called.should.equal false

			it "should call the callback with the error", ->
				@callback.calledWithExactly(@error)
				.should.equal true

	describe "doCompile", ->
		beforeEach ->
			@output_files = [{
				path: "output.log"
				type: "log"
			}, {
				path: "output.pdf"
				type: "pdf"
			}]
			@build_files = [{
				path: "output.log"
				type: "log"
				build: 1234
			}, {
				path: "output.pdf"
				type: "pdf"
				build: 1234
			}]
			@request =
				resources: @resources = "mock-resources"
				rootResourcePath: @rootResourcePath = "main.tex"
				project_id: @project_id
				user_id: @user_id
				compiler: @compiler = "pdflatex"
				timeout: @timeout = 42000
				imageName: @image = "example.com/image"
				flags: @flags = ["-file-line-error"]
			@env = {}
			@Settings.compileDir = "compiles"
			@compileDir = "#{@Settings.path.compilesDir}/#{@project_id}-#{@user_id}"
			@ResourceWriter.syncResourcesToDisk = sinon.stub().callsArgWith(2, null, @resources)
			@LatexRunner.runLatex = sinon.stub().callsArg(2)
			@OutputFileFinder.findOutputFiles = sinon.stub().callsArgWith(2, null, @output_files)
			@OutputCacheManager.saveOutputFiles = sinon.stub().callsArgWith(2, null, @build_files)
			@DraftModeManager.injectDraftMode = sinon.stub().callsArg(1)
			@TikzManager.checkMainFile = sinon.stub().callsArg(3, false)

		describe "normally", ->
			beforeEach ->
				@CompileManager.doCompile @request, @callback

			it "should write the resources to disk", ->
				@ResourceWriter.syncResourcesToDisk
					.calledWith(@request, @compileDir)
					.should.equal true

			it "should run LaTeX", ->
				@LatexRunner.runLatex
					.calledWith("#{@project_id}-#{@user_id}", {
						directory: @compileDir
						mainFile:  @rootResourcePath
						compiler:  @compiler
						timeout:   @timeout
						image:     @image
						flags:     @flags
						environment: @env
					})
					.should.equal true

			it "should find the output files", ->
				@OutputFileFinder.findOutputFiles
					.calledWith(@resources, @compileDir)
					.should.equal true

			it "should return the output files", ->
				@callback.calledWith(null, @build_files).should.equal true

			it "should not inject draft mode by default", ->
				@DraftModeManager.injectDraftMode.called.should.equal false

		describe "with draft mode", ->
			beforeEach ->
				@request.draft = true
				@CompileManager.doCompile @request, @callback

			it "should inject the draft mode header", ->
				@DraftModeManager.injectDraftMode
					.calledWith(@compileDir + "/" + @rootResourcePath)
					.should.equal true

		describe "with a check option", ->
			beforeEach ->
				@request.check = "error"
				@CompileManager.doCompile @request, @callback

			it "should run chktex", ->
				@LatexRunner.runLatex
					.calledWith("#{@project_id}-#{@user_id}", {
						directory: @compileDir
						mainFile:  @rootResourcePath
						compiler:  @compiler
						timeout:   @timeout
						image:     @image
						flags:     @flags
						environment: {'CHKTEX_OPTIONS': '-nall -e9 -e10 -w15 -w16', 'CHKTEX_EXIT_ON_ERROR':1, 'CHKTEX_ULIMIT_OPTIONS': '-t 5 -v 64000'}
					})
					.should.equal true

		describe "with a knitr file and check options", ->
			beforeEach ->
				@request.rootResourcePath = "main.Rtex"
				@request.check = "error"
				@CompileManager.doCompile @request, @callback

			it "should not run chktex", ->
				@LatexRunner.runLatex
					.calledWith("#{@project_id}-#{@user_id}", {
						directory: @compileDir
						mainFile:  "main.Rtex"
						compiler:  @compiler
						timeout:   @timeout
						image:     @image
						flags:     @flags
						environment: @env
					})
					.should.equal true

	describe "clearProject", ->
		describe "succesfully", ->
			beforeEach ->
				@Settings.compileDir = "compiles"
				@fs.lstat = sinon.stub().callsArgWith(1, null,{isDirectory: ()->true})
				@proc = new EventEmitter()
				@proc.stdout = new EventEmitter()
				@proc.stderr = new EventEmitter()
				@child_process.spawn = sinon.stub().returns(@proc)
				@CompileManager.clearProject @project_id, @user_id, @callback
				@proc.emit "close", 0

			it "should remove the project directory", ->
				@child_process.spawn
					.calledWith("rm", ["-r", "#{@Settings.path.compilesDir}/#{@project_id}-#{@user_id}"])
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "with a non-success status code", ->
			beforeEach ->
				@Settings.compileDir = "compiles"
				@fs.lstat = sinon.stub().callsArgWith(1, null,{isDirectory: ()->true})
				@proc = new EventEmitter()
				@proc.stdout = new EventEmitter()
				@proc.stderr = new EventEmitter()
				@child_process.spawn = sinon.stub().returns(@proc)
				@CompileManager.clearProject @project_id, @user_id, @callback
				@proc.stderr.emit "data", @error = "oops"
				@proc.emit "close", 1

			it "should remove the project directory", ->
				@child_process.spawn
					.calledWith("rm", ["-r", "#{@Settings.path.compilesDir}/#{@project_id}-#{@user_id}"])
					.should.equal true

			it "should call the callback with an error from the stderr", ->
				@callback
					.calledWith(new Error())
					.should.equal true

				@callback.args[0][0].message.should.equal "rm -r #{@Settings.path.compilesDir}/#{@project_id}-#{@user_id} failed: #{@error}"

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
			@Settings.path.synctexBaseDir = (project_id) => "#{@Settings.path.compilesDir}/#{@project_id}-#{@user_id}"

		describe "syncFromCode", ->
			beforeEach ->
				@fs.stat = sinon.stub().callsArgWith(1, null,{isFile: ()->true})
				@stdout = "NODE\t#{@page}\t#{@h}\t#{@v}\t#{@width}\t#{@height}\n"
				@CommandRunner.run = sinon.stub().callsArgWith(6, null, {stdout:@stdout})
				@CompileManager.syncFromCode @project_id, @user_id, @file_name, @line, @column, @callback

			it "should execute the synctex binary", ->
				bin_path = Path.resolve(__dirname + "/../../../bin/synctex")
				synctex_path = "#{@Settings.path.compilesDir}/#{@project_id}-#{@user_id}/output.pdf"
				file_path = "#{@Settings.path.compilesDir}/#{@project_id}-#{@user_id}/#{@file_name}"
				@CommandRunner.run
					.calledWith(
						"#{@project_id}-#{@user_id}",
						['/opt/synctex', 'code', synctex_path, file_path, @line, @column],
						"#{@Settings.path.compilesDir}/#{@project_id}-#{@user_id}",
						@Settings.clsi.docker.image,
						60000,
						{}
						).should.equal true

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
				@fs.stat = sinon.stub().callsArgWith(1, null,{isFile: ()->true})
				@stdout = "NODE\t#{@Settings.path.compilesDir}/#{@project_id}-#{@user_id}/#{@file_name}\t#{@line}\t#{@column}\n"
				@CommandRunner.run = sinon.stub().callsArgWith(6, null, {stdout:@stdout})
				@CompileManager.syncFromPdf @project_id, @user_id, @page, @h, @v, @callback

			it "should execute the synctex binary", ->
				bin_path = Path.resolve(__dirname + "/../../../bin/synctex")
				synctex_path = "#{@Settings.path.compilesDir}/#{@project_id}-#{@user_id}/output.pdf"
				@CommandRunner.run
					.calledWith(
						"#{@project_id}-#{@user_id}",
						['/opt/synctex', "pdf", synctex_path, @page, @h, @v],
						"#{@Settings.path.compilesDir}/#{@project_id}-#{@user_id}",
						@Settings.clsi.docker.image,
						60000,
						{}).should.equal true

			it "should call the callback with the parsed output", ->
				@callback
					.calledWith(null, [{
						file: @file_name
						line: @line
						column: @column
					}])
					.should.equal true

	describe "wordcount", ->
		beforeEach ->
			@CommandRunner.run = sinon.stub().callsArg(6)
			@fs.readFile = sinon.stub().callsArgWith(2, null, @stdout = "Encoding: ascii\nWords in text: 2")
			@callback  = sinon.stub()

			@project_id
			@timeout = 60 * 1000
			@file_name = "main.tex"
			@Settings.path.compilesDir = "/local/compile/directory"
			@image = "example.com/image"

			@CompileManager.wordcount @project_id, @user_id, @file_name, @image, @callback

		it "should run the texcount command", ->
			@directory = "#{@Settings.path.compilesDir}/#{@project_id}-#{@user_id}"
			@file_path = "$COMPILE_DIR/#{@file_name}"
			@command =[ "texcount", "-nocol", "-inc", @file_path, "-out=" + @file_path + ".wc"]

			@CommandRunner.run
				.calledWith("#{@project_id}-#{@user_id}", @command, @directory, @image, @timeout, {})
				.should.equal true

		it "should call the callback with the parsed output", ->
			@callback
				.calledWith(null, {
					encode: "ascii"
					textWords: 2
					headWords: 0
					outside: 0
					headers: 0
					elements: 0
					mathInline: 0
					mathDisplay: 0
					errors: 0
					messages: ""
				})
				.should.equal true
