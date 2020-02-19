SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../app/js/TikzManager'

describe 'TikzManager', ->
	beforeEach ->
		@TikzManager = SandboxedModule.require modulePath, requires:
			"./ResourceWriter": @ResourceWriter = {}
			"./SafeReader": @SafeReader = {}
			"fs": @fs = {}
			"logger-sharelatex": @logger = {log: () ->}

	describe "checkMainFile", ->
		beforeEach ->
				@compileDir = "compile-dir"
				@mainFile = "main.tex"
				@callback = sinon.stub()

		describe "if there is already an output.tex file in the resources", ->
			beforeEach ->
				@resources = [{path:"main.tex"},{path:"output.tex"}]
				@TikzManager.checkMainFile @compileDir, @mainFile, @resources, @callback

			it "should call the callback with false ", ->
				@callback.calledWithExactly(null, false)
				.should.equal true

		describe "if there is no output.tex file in the resources", ->
			beforeEach ->
				@resources = [{path:"main.tex"}]
				@ResourceWriter.checkPath = sinon.stub()
					.withArgs(@compileDir, @mainFile)
					.callsArgWith(2, null, "#{@compileDir}/#{@mainFile}")

			describe "and the main file contains tikzexternalize", ->
				beforeEach ->
					@SafeReader.readFile = sinon.stub()
						.withArgs("#{@compileDir}/#{@mainFile}")
						.callsArgWith(3, null, "hello \\tikzexternalize")
					@TikzManager.checkMainFile @compileDir, @mainFile, @resources, @callback

				it "should look at the file on disk", ->
					@SafeReader.readFile
					.calledWith("#{@compileDir}/#{@mainFile}")
					.should.equal true

				it "should call the callback with true ", ->
					@callback.calledWithExactly(null, true)
					.should.equal true

			describe "and the main file does not contain tikzexternalize", ->
				beforeEach ->
					@SafeReader.readFile = sinon.stub()
						.withArgs("#{@compileDir}/#{@mainFile}")
						.callsArgWith(3, null, "hello")
					@TikzManager.checkMainFile @compileDir, @mainFile, @resources, @callback

				it "should look at the file on disk", ->
					@SafeReader.readFile
					.calledWith("#{@compileDir}/#{@mainFile}")
					.should.equal true

				it "should call the callback with false", ->
					@callback.calledWithExactly(null, false)
					.should.equal true

			describe "and the main file contains \\usepackage{pstool}", ->
				beforeEach ->
					@SafeReader.readFile = sinon.stub()
						.withArgs("#{@compileDir}/#{@mainFile}")
						.callsArgWith(3, null, "hello \\usepackage[random-options]{pstool}")
					@TikzManager.checkMainFile @compileDir, @mainFile, @resources, @callback

				it "should look at the file on disk", ->
					@SafeReader.readFile
					.calledWith("#{@compileDir}/#{@mainFile}")
					.should.equal true

				it "should call the callback with true ", ->
					@callback.calledWithExactly(null, true)
					.should.equal true

	describe "injectOutputFile", ->
		beforeEach ->
			@rootDir = "/mock"
			@filename = "filename.tex"
			@callback = sinon.stub()
			@content = '''
				\\documentclass{article}
				\\usepackage{tikz}
				\\tikzexternalize
				\\begin{document}
				Hello world
				\\end{document}
			'''
			@fs.readFile = sinon.stub().callsArgWith(2, null, @content)
			@fs.writeFile = sinon.stub().callsArg(3)
			@ResourceWriter.checkPath = sinon.stub().callsArgWith(2, null, "#{@rootDir}/#{@filename}")
			@TikzManager.injectOutputFile @rootDir, @filename, @callback

		it "sould check the path", ->
			@ResourceWriter.checkPath.calledWith(@rootDir, @filename)
			.should.equal true

		it "should read the file", ->
			@fs.readFile
				.calledWith("#{@rootDir}/#{@filename}", "utf8")
				.should.equal true

		it "should write out the same file as output.tex", ->
			@fs.writeFile
				.calledWith("#{@rootDir}/output.tex", @content, {flag: 'wx'})
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true
