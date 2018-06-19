expect = require("chai").expect
request = require './helpers/request'
Settings = require "settings-sharelatex"

auth = new Buffer('sharelatex:password').toString("base64")
authed_request = request.defaults
	headers:
		Authorization: "Basic #{auth}"


describe 'ApiClsiTests', ->
	describe 'compile', ->
		before (done) ->
			@compileSpec =
				compile:
					options:
						compiler: 'pdflatex'
						timeout: 60
					rootResourcePath: 'main.tex'
					resources: [
						path: 'main/tex'
						content: "\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}"
					,
						path: 'image.png'
						url: 'www.example.com/image.png'
						modified: 123456789
					]
			done()

		describe 'valid request', ->
			it 'returns success and a list of output files', (done) ->
				authed_request.post {
					uri: '/api/clsi/compile/abcd'
					json: @compileSpec
					}, (error, response, body) ->
						throw error if error?
						expect(response.statusCode).to.equal 200
						expect(response.body).to.deep.equal {
							status: 'success'
							outputFiles: [
								path: 'project.pdf'
								url: '/project/abcd/build/1234/output/project.pdf'
								type: 'pdf'
								build: 1234
							,
								path: 'project.log'
								url: '/project/abcd/build/1234/output/project.log'
								type: 'log'
								build: 1234
							]
						}
						done()

		describe 'unauthorized', ->
			it 'returns 401', (done) ->
				request.post {
					uri: '/api/clsi/compile/abcd'
					json: @compileSpec
					}, (error, response, body) ->
						throw error if error?
						expect(response.statusCode).to.equal 401
						expect(response.body).to.equal 'Unauthorized'
						done()

	describe 'get output', ->
		describe 'valid file', ->
			it 'returns the file', (done) ->
				authed_request.get '/api/clsi/compile/abcd/build/1234/output/project.pdf', (error, response, body) ->
					throw error if error?
					expect(response.statusCode).to.equal 200
					expect(response.body).to.equal 'mock-pdf'
					done()

		describe 'invalid file', ->
			it 'returns 404', (done) ->
				authed_request.get '/api/clsi/compile/abcd/build/1234/output/project.aux', (error, response, body) ->
					throw error if error?
					expect(response.statusCode).to.equal 404
					expect(response.body).to.not.equal 'mock-pdf'
					done()

		describe 'unauthorized', ->
			it 'returns 401', (done) ->
				request.get '/api/clsi/compile/abcd/build/1234/output/project.pdf', (error, response, body) ->
					throw error if error?
					expect(response.statusCode).to.equal 401
					expect(response.body).to.not.equal 'mock-pdf'
					done()
