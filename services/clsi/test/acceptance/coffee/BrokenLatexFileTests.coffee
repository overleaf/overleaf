Client = require "./helpers/Client"
request = require "request"
require("chai").should()

describe "Broken LaTeX file", ->
	before ->
		@broken_request =
			resources: [
				path: "main.tex"
				content: '''
					\\documentclass{articl % :(
					\\begin{documen % :(
					Broken
					\\end{documen % :(
				'''
			]
		@correct_request =
			resources: [
				path: "main.tex"
				content: '''
					\\documentclass{article}
					\\begin{document}
					Hello world
					\\end{document}
				'''
			]
		
	describe "on first run", ->
		before (done) ->
			@project_id = Client.randomId()
			Client.compile @project_id, @broken_request, (@error, @res, @body) => done()

		it "should return a failure status", ->
			@body.compile.status.should.equal "failure"

	describe "on second run", ->
		before (done) ->
			@project_id = Client.randomId()
			Client.compile @project_id, @correct_request, () =>
				Client.compile @project_id, @broken_request, (@error, @res, @body) =>
					done()

		it "should return a failure status", ->
			@body.compile.status.should.equal "failure"
		
		
