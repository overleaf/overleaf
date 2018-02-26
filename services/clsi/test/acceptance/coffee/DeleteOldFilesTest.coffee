# Client = require "./helpers/Client"
# request = require "request"
# require("chai").should()
# ClsiApp = require "./helpers/ClsiApp"

# describe "Deleting Old Files", ->
# 	before (done)->
# 		@request =
# 			resources: [
# 				path: "main.tex"
# 				content: '''
# 					\\documentclass{article}
# 					\\begin{document}
# 					Hello world
# 					\\end{document}
# 				'''
# 			]
# 		ClsiApp.ensureRunning done

# 	describe "on first run", ->
# 		before (done) ->
# 			@project_id = Client.randomId()
# 			Client.compile @project_id, @request, (@error, @res, @body) => done()

# 		it "should return a success status", ->
# 			@body.compile.status.should.equal "success"

# 		describe "after file has been deleted", ->
# 			before (done) ->
# 				@request.resources = []
# 				Client.compile @project_id, @request, (@error, @res, @body) =>
# 					done()

# 			it "should return a failure status", ->
# 				@body.compile.status.should.equal "failure"

