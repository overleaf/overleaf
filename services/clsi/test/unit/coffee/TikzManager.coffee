SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../app/js/TikzManager'

describe 'TikzManager', ->
	beforeEach ->
		@TikzManager = SandboxedModule.require modulePath, requires:
			"fs": @fs = {}
			"logger-sharelatex": @logger = {log: () ->}

	describe "needsOutputFile", ->
		it "should return true if there is a usepackage{tikz}", ->
			@TikzManager.needsOutputFile("main.tex", [
				{ path: 'foo.tex' },
				{ path: 'main.tex', content:'foo \\usepackage{tikz}' }
			]).should.equal true

		it "should return true if there is a usepackage{pgf}", ->
			@TikzManager.needsOutputFile("main.tex", [
				{ path: 'foo.tex'},
				{ path: 'main.tex', content:'foo \\usepackage{pgf}' }
			]).should.equal true

		it "should return false if there is no usepackage{tikz} or {pgf}", ->
			@TikzManager.needsOutputFile("main.tex", [
				{ path: 'foo.tex' },
				{ path: 'main.tex', content:'foo \\usepackage{bar}' }
			]).should.equal false

		it "should return false if there is already an output.tex file", ->
			@TikzManager.needsOutputFile("main.tex", [
				{ path: 'foo.tex' },
				{ path: 'main.tex' },
				{ path: 'output.tex' }
			]).should.equal false

	describe "injectOutputFile", ->
		beforeEach ->
			@rootDir = "/mock"
			@filename = "filename.tex"
			@callback = sinon.stub()
			@content = '''
				\\documentclass{article}
				\\usepackage{tikz}
				\\begin{document}
				Hello world
				\\end{document}
			'''
			@fs.readFile = sinon.stub().callsArgWith(2, null, @content)
			@fs.writeFile = sinon.stub().callsArg(3)
			@TikzManager.injectOutputFile @rootDir, @filename, @callback

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
