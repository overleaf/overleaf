Client = require "./helpers/Client"
request = require "request"
require("chai").should()
expect = require("chai").expect

describe "Syncing", ->
	before (done) ->
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
		@project_id = Client.randomId()
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
			Client.syncFromPdf @project_id, 1, 100, 200, (error, codePositions) ->
				throw error if error?
				expect(codePositions).to.deep.equal(
					code: [ { file: 'main.tex', line: 3, column: -1 } ]
				)
				done()

	describe "wordcount file", ->
		it "should return wordcount info", (done) ->
			Client.wordcount @project_id, "main.tex", (error, result) ->
				throw error if error?
				expect(result).to.deep.equal(
					texcount: { 
						encode: "ascii"
						textWords: 2
						headWords: 0
						outside: 0
						headers: 0
						elements: 0
						mathInline: 0
						mathDisplay: 0
					}
				)
				done()
