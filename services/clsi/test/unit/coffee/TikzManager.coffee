SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../app/js/TikzManager'

describe 'TikzManager', ->
	beforeEach ->
		@TikzManager = SandboxedModule.require modulePath, requires:
			"./ResourceWriter": @ResourceWriter = {}
			"fs": @fs = {}
			"logger-sharelatex": @logger = {log: () ->}

	describe "needsOutputFile", ->
		it "should return true if there is a \\tikzexternalize", ->
			@TikzManager.needsOutputFile("main.tex", [
				{ path: 'foo.tex' },
				{ path: 'main.tex', content:'foo \\usepackage{tikz} \\tikzexternalize' }
			]).should.equal true

		it "should return false if there is no \\tikzexternalize", ->
			@TikzManager.needsOutputFile("main.tex", [
				{ path: 'foo.tex' },
				{ path: 'main.tex', content:'foo \\usepackage{tikz}' }
			]).should.equal false

		it "should return false if there is already an output.tex file", ->
			@TikzManager.needsOutputFile("main.tex", [
				{ path: 'foo.tex' },
				{ path: 'main.tex', content:'foo \\usepackage{tikz} \\tikzexternalize' },
				{ path: 'output.tex' }
			]).should.equal false

		it "should return false if the file has no content", ->
			@TikzManager.needsOutputFile("main.tex", [
				{ path: 'foo.tex' },
				{ path: 'main.tex' }
			]).should.equal false

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
