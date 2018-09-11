Client = require "./helpers/Client"
request = require "request"
require("chai").should()
sinon = require "sinon"
ClsiApp = require "./helpers/ClsiApp"

host = "localhost"

Server =
	run: () ->
		express = require "express"
		app = express()

		staticServer = express.static __dirname + "/../fixtures/"
		app.get "/:random_id/*", (req, res, next) =>
			@getFile(req.url)
			req.url = "/" + req.params[0]
			staticServer(req, res, next)

		app.listen 31415, host

	getFile: () ->

	randomId: () ->
		Math.random().toString(16).slice(2)

Server.run()

describe "Url Caching", ->
	describe "Downloading an image for the first time", ->
		before (done) ->
			@project_id = Client.randomId()
			@file = "#{Server.randomId()}/lion.png"
			@request =
				resources: [{
					path: "main.tex"
					content: '''
						\\documentclass{article}
						\\usepackage{graphicx}
						\\begin{document}
						\\includegraphics{lion.png}
						\\end{document}
					'''
				}, {
					path: "lion.png"
					url: "http://#{host}:31415/#{@file}"
				}]

			sinon.spy Server, "getFile"
			ClsiApp.ensureRunning =>
				Client.compile @project_id, @request, (@error, @res, @body) => done()

		afterEach ->
			Server.getFile.restore()

		it "should download the image", ->
			Server.getFile
				.calledWith("/" + @file)
				.should.equal true
				
	describe "When an image is in the cache and the last modified date is unchanged", ->
		before (done) ->
			@project_id = Client.randomId()
			@file = "#{Server.randomId()}/lion.png"
			@request =
				resources: [{
					path: "main.tex"
					content: '''
						\\documentclass{article}
						\\usepackage{graphicx}
						\\begin{document}
						\\includegraphics{lion.png}
						\\end{document}
					'''
				}, @image_resource = {
					path: "lion.png"
					url: "http://#{host}:31415/#{@file}"
					modified: Date.now()
				}]

			Client.compile @project_id, @request, (@error, @res, @body) =>
				sinon.spy Server, "getFile"
				Client.compile @project_id, @request, (@error, @res, @body) =>
					done()

		after ->
			Server.getFile.restore()

		it "should not download the image again", ->
			Server.getFile.called.should.equal false

	describe "When an image is in the cache and the last modified date is advanced", ->
		before (done) ->
			@project_id = Client.randomId()
			@file = "#{Server.randomId()}/lion.png"
			@request =
				resources: [{
					path: "main.tex"
					content: '''
						\\documentclass{article}
						\\usepackage{graphicx}
						\\begin{document}
						\\includegraphics{lion.png}
						\\end{document}
					'''
				}, @image_resource = {
					path: "lion.png"
					url: "http://#{host}:31415/#{@file}"
					modified: @last_modified = Date.now()
				}]

			Client.compile @project_id, @request, (@error, @res, @body) =>
				sinon.spy Server, "getFile"
				@image_resource.modified = new Date(@last_modified + 3000)
				Client.compile @project_id, @request, (@error, @res, @body) =>
					done()

		afterEach ->
			Server.getFile.restore()

		it "should download the image again", ->
			Server.getFile.called.should.equal true

	describe "When an image is in the cache and the last modified date is further in the past", ->
		before (done) ->
			@project_id = Client.randomId()
			@file = "#{Server.randomId()}/lion.png"
			@request =
				resources: [{
					path: "main.tex"
					content: '''
						\\documentclass{article}
						\\usepackage{graphicx}
						\\begin{document}
						\\includegraphics{lion.png}
						\\end{document}
					'''
				}, @image_resource = {
					path: "lion.png"
					url: "http://#{host}:31415/#{@file}"
					modified: @last_modified = Date.now()
				}]

			Client.compile @project_id, @request, (@error, @res, @body) =>
				sinon.spy Server, "getFile"
				@image_resource.modified = new Date(@last_modified - 3000)
				Client.compile @project_id, @request, (@error, @res, @body) =>
					done()

		afterEach ->
			Server.getFile.restore()

		it "should not download the image again", ->
			Server.getFile.called.should.equal false

	describe "When an image is in the cache and the last modified date is not specified", ->
		before (done) ->
			@project_id = Client.randomId()
			@file = "#{Server.randomId()}/lion.png"
			@request =
				resources: [{
					path: "main.tex"
					content: '''
						\\documentclass{article}
						\\usepackage{graphicx}
						\\begin{document}
						\\includegraphics{lion.png}
						\\end{document}
					'''
				}, @image_resource = {
					path: "lion.png"
					url: "http://#{host}:31415/#{@file}"
					modified: @last_modified = Date.now()
				}]

			Client.compile @project_id, @request, (@error, @res, @body) =>
				sinon.spy Server, "getFile"
				delete @image_resource.modified
				Client.compile @project_id, @request, (@error, @res, @body) =>
					done()

		afterEach ->
			Server.getFile.restore()

		it "should download the image again", ->
			Server.getFile.called.should.equal true
		
	describe "After clearing the cache", ->
		before (done) ->
			@project_id = Client.randomId()
			@file = "#{Server.randomId()}/lion.png"
			@request =
				resources: [{
					path: "main.tex"
					content: '''
						\\documentclass{article}
						\\usepackage{graphicx}
						\\begin{document}
						\\includegraphics{lion.png}
						\\end{document}
					'''
				}, @image_resource = {
					path: "lion.png"
					url: "http://#{host}:31415/#{@file}"
					modified: @last_modified = Date.now()
				}]

			Client.compile @project_id, @request, (error) =>
				throw error if error?
				Client.clearCache @project_id, (error, res, body) =>
					throw error if error?
					sinon.spy Server, "getFile"
					Client.compile @project_id, @request, (@error, @res, @body) =>
						done()

		afterEach ->
			Server.getFile.restore()

		it "should download the image again", ->
			Server.getFile.called.should.equal true
		
				
