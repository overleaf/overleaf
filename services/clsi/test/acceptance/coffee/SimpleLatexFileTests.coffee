Client = require "./helpers/Client"
request = require "request"
require("chai").should()
ClsiApp = require "./helpers/ClsiApp"

describe "Simple LaTeX file", ->
	before (done) ->
		@project_id = Client.randomId()
		@request =
			resources: [
				path: "main.tex"
				content: '''
					\\documentclass{article}
					\\begin{document}
					Hello world
					\\end{document}
				'''
			]
		ClsiApp.ensureRunning =>
			Client.compile @project_id, @request, (@error, @res, @body) => done()

	it "should return the PDF", ->
		pdf = Client.getOutputFile(@body, "pdf")
		pdf.type.should.equal "pdf"
		
	it "should return the log", ->
		log = Client.getOutputFile(@body, "log")
		log.type.should.equal "log"

	it "should provide the pdf for download", (done) ->
		pdf = Client.getOutputFile(@body, "pdf")
		request.get pdf.url, (error, res, body) ->
			res.statusCode.should.equal 200
			done()
		
	it "should provide the log for download", (done) ->
		log = Client.getOutputFile(@body, "pdf")
		request.get log.url, (error, res, body) ->
			res.statusCode.should.equal 200
			done()
	
