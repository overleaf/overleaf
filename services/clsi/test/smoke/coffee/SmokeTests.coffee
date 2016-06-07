chai = require("chai")
chai.should() unless Object.prototype.should?
expect = chai.expect
request = require "request"
Settings = require "settings-sharelatex"

buildUrl = (path) -> "http://#{Settings.internal.clsi.host}:#{Settings.internal.clsi.port}/#{path}"

url = buildUrl("project/smoketest-#{process.pid}/compile")

describe "Running a compile", ->
	before (done) ->
		request.post {
			url: url
			json:
				compile:
					resources: [
						path: "main.tex"
						content: """
							\\documentclass{article}
							\\begin{document}
							Hello world
							\\end{document}
						"""
					]
		}, (@error, @response, @body) =>
			done()

	it "should return the pdf", ->
		for file in @body.compile.outputFiles
			return if file.type == "pdf"
		throw new Error("no pdf returned")
	
	it "should return the log", ->
		for file in @body.compile.outputFiles
			return if file.type == "log"
		throw new Error("no log returned")
