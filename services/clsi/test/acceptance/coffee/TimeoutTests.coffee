Client = require "./helpers/Client"
request = require "request"
require("chai").should()
ClsiApp = require "./helpers/ClsiApp"


describe "Timed out compile", ->
	before (done) ->
		@request =
			options:
				timeout: 10 #seconds
			resources: [
				path: "main.tex"
				content: '''
					\\documentclass{article}
					\\begin{document}
					\\def\\x{Hello!\\par\\x}
					\\x
					\\end{document}
				'''
			]
		@project_id = Client.randomId()
		ClsiApp.ensureRunning =>
			Client.compile @project_id, @request, (@error, @res, @body) => done()

	it "should return a timeout error", ->
		@body.compile.error.should.equal "container timed out"

	it "should return a timedout status", ->
		@body.compile.status.should.equal "timedout"

	it "should return the log output file name", ->
		outputFilePaths = @body.compile.outputFiles.map((x) => x.path)
		outputFilePaths.should.include('output.log')
