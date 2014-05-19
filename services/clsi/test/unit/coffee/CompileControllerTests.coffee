SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../app/js/CompileController'
tk = require("timekeeper")

describe "CompileController", ->
	beforeEach ->
		@CompileController = SandboxedModule.require modulePath, requires:
			"./CompileManager": @CompileManager = {}
			"./RequestParser": @RequestParser = {}
			"settings-sharelatex": @Settings =
				apis:
					clsi:
						url: "http://clsi.example.com"
			"./ProjectPersistenceManager": @ProjectPersistenceManager = {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
		@Settings.externalUrl = "http://www.example.com"
		@req = {}
		@res = {}
		@next = sinon.stub()

	describe "compile", ->
		beforeEach ->
			@req.body = {
				compile: "mock-body"
			}
			@req.params =
				project_id: @project_id = "project-id-123"
			@request = {
				compile: "mock-parsed-request"
			}
			@request_with_project_id =
				compile: @request.compile
				project_id: @project_id
			@output_files = [{
				path: "output.pdf"
				type: "pdf"
			}, {
				path: "output.log"
				type: "log"
			}]
			@RequestParser.parse = sinon.stub().callsArgWith(1, null, @request)
			@ProjectPersistenceManager.markProjectAsJustAccessed = sinon.stub().callsArg(1)
			@res.send = sinon.stub()

		describe "successfully", ->
			beforeEach ->
				@CompileManager.doCompile = sinon.stub().callsArgWith(1, null, @output_files)
				@CompileController.compile @req, @res

			it "should parse the request", ->
				@RequestParser.parse
					.calledWith(@req.body)
					.should.equal true

			it "should run the compile for the specified project", ->
				@CompileManager.doCompile
					.calledWith(@request_with_project_id)
					.should.equal true

			it "should mark the project as accessed", ->
				@ProjectPersistenceManager.markProjectAsJustAccessed
					.calledWith(@project_id)
					.should.equal true

			it "should return the JSON response", ->
				@res.send
					.calledWith(200,
						compile:
							status: "success"
							error: null
							outputFiles: @output_files.map (file) =>
								url: "#{@Settings.apis.clsi.url}/project/#{@project_id}/output/#{file.path}"
								type: file.type
					)
					.should.equal true
			
		describe "with an error", ->
			beforeEach ->
				@CompileManager.doCompile = sinon.stub().callsArgWith(1, new Error(@message = "error message"), null)
				@CompileController.compile @req, @res
		
			it "should return the JSON response with the error", ->
				@res.send
					.calledWith(500,
						compile:
							status: "error"
							error:  @message
							outputFiles: []
					)
					.should.equal true

		describe "when the request times out", ->
			beforeEach ->
				@error = new Error(@message = "container timed out")
				@error.timedout = true
				@CompileManager.doCompile = sinon.stub().callsArgWith(1, @error, null)
				@CompileController.compile @req, @res
		
			it "should return the JSON response with the timeout status", ->
				@res.send
					.calledWith(200,
						compile:
							status: "timedout"
							error: @message
							outputFiles: []
					)
					.should.equal true

		describe "when the request returns no output files", ->
			beforeEach ->
				@CompileManager.doCompile = sinon.stub().callsArgWith(1, null, [])
				@CompileController.compile @req, @res
		
			it "should return the JSON response with the failure status", ->
				@res.send
					.calledWith(200,
						compile:
							error: null
							status: "failure"
							outputFiles: []
					)
					.should.equal true

	describe "syncFromCode", ->
		beforeEach ->
			@file = "main.tex"
			@line = 42
			@column = 5
			@project_id = "mock-project-id"
			@req.params =
				project_id: @project_id
			@req.query =
				file: @file
				line: @line.toString()
				column: @column.toString()
			@res.send = sinon.stub()

			@CompileManager.syncFromCode = sinon.stub().callsArgWith(4, null, @pdfPositions = ["mock-positions"])
			@CompileController.syncFromCode @req, @res, @next

		it "should find the corresponding location in the PDF", ->
			@CompileManager.syncFromCode
				.calledWith(@project_id, @file, @line, @column)
				.should.equal true

		it "should return the positions", ->
			@res.send
				.calledWith(JSON.stringify
					pdf: @pdfPositions
				)
				.should.equal true

	describe "syncFromPdf", ->
		beforeEach ->
			@page = 5
			@h = 100.23
			@v = 45.67
			@project_id = "mock-project-id"
			@req.params =
				project_id: @project_id
			@req.query =
				page: @page.toString()
				h: @h.toString()
				v: @v.toString()
			@res.send = sinon.stub()

			@CompileManager.syncFromPdf = sinon.stub().callsArgWith(4, null, @codePositions = ["mock-positions"])
			@CompileController.syncFromPdf @req, @res, @next

		it "should find the corresponding location in the code", ->
			@CompileManager.syncFromPdf
				.calledWith(@project_id, @page, @h, @v)
				.should.equal true

		it "should return the positions", ->
			@res.send
				.calledWith(JSON.stringify
					code: @codePositions
				)
				.should.equal true

