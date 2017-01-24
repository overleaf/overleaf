Client = require "./helpers/Client"
request = require "request"
require("chai").should()
expect = require("chai").expect
path = require("path")
fs = require("fs")

describe "Syncing", ->
	before (done) ->
		@request =
			resources: [
				path: "main.tex"
				content: fs.readFileSync(path.join(__dirname,"../fixtures/naugty_strings.txt"),"utf-8")
			]
		@project_id = Client.randomId()
		Client.compile @project_id, @request, (@error, @res, @body) => done()

	describe "wordcount file", ->
		it "should return wordcount info", (done) ->
			Client.wordcount @project_id, "main.tex", (error, result) ->
				throw error if error?
				expect(result).to.deep.equal(
					texcount: { 
						encode: "utf8"
						textWords: 2281
						headWords: 2
						outside: 0
						headers: 2
						elements: 0
						mathInline: 6
						mathDisplay: 0
						errors: 0
						messages: ""
					}
				)
				done()
