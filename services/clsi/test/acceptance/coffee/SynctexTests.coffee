Client = require "./helpers/Client"
request = require "request"
require("chai").should()
expect = require("chai").expect
ClsiApp = require "./helpers/ClsiApp"
crypto = require("crypto")

describe "Syncing", ->
	before (done) ->
		content = '''
					\\documentclass{article}
					\\begin{document}
					Hello world
					\\end{document}
				'''
		@request =
			resources: [
				path: "main.tex"
				content: content
			]
		@project_id = Client.randomId()
		ClsiApp.ensureRunning =>
			Client.compile @project_id, @request, (@error, @res, @body) => done()

	describe "from code to pdf", ->
		it "should return the correct location", (done) ->
			Client.syncFromCode @project_id, "main.tex", 3, 5, (error, pdfPositions) ->
				throw error if error?
				expect(pdfPositions).to.deep.equal(
					pdf: [ { page: 1, h: 133.77, v: 134.76, height: 6.92, width: 343.71 } ]
				)
				done()

	describe "from pdf to code", ->
		it "should return the correct location", (done) ->
			Client.syncFromPdf @project_id, 1, 100, 200, (error, codePositions) =>
				throw error if error?
				expect(codePositions).to.deep.equal(
					code: [ { file: 'main.tex', line: 3, column: -1 } ]
				)
				done()
