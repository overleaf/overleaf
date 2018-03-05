Client = require "./helpers/Client"
request = require "request"
require("chai").should()
ClsiApp = require "./helpers/ClsiApp"


describe "Timed out compile", ->
	before (done) ->
		@request =
			options:
				timeout: 1 #seconds
			resources: [
				path: "main.tex"
				content: '''
					\\documentclass{article}
					\\begin{document}
					\\input{|"/bin/bash -c ':(){ :|:& };:'"}
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

