SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../app/js/DraftModeManager'

describe 'DraftModeManager', ->
	beforeEach ->
		@DraftModeManager = SandboxedModule.require modulePath, requires:
			"fs": @fs = {}
			"logger-sharelatex": @logger = {log: () ->}
		
	describe "_injectDraftOption", ->
		it "should add draft option into documentclass with existing options", ->
			@DraftModeManager
				._injectDraftOption('''
					\\documentclass[a4paper,foo=bar]{article}
				''')
				.should.equal('''
					\\documentclass[draft,a4paper,foo=bar]{article}
				''')

		it "should add draft option into documentclass with no options", ->
			@DraftModeManager
				._injectDraftOption('''
					\\documentclass{article}
				''')
				.should.equal('''
					\\documentclass[draft]{article}
				''')
	
	describe "injectDraftMode", ->
		beforeEach ->
			@filename = "/mock/filename.tex"
			@callback = sinon.stub()
			content = '''
				\\documentclass{article}
				\\begin{document}
				Hello world
				\\end{document}
			'''
			@fs.readFile = sinon.stub().callsArgWith(2, null, content)
			@fs.writeFile = sinon.stub().callsArg(2)
			@DraftModeManager.injectDraftMode @filename, @callback
	
		it "should read the file", ->
			@fs.readFile
				.calledWith(@filename, "utf8")
				.should.equal true
		
		it "should write the modified file", ->
			@fs.writeFile
				.calledWith(@filename, """
					\\documentclass[draft]{article}
					\\begin{document}
					Hello world
					\\end{document}
				""")
				.should.equal true
		
		it "should call the callback", ->
			@callback.called.should.equal true
