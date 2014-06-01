sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Compile/ClsiManager.js"
SandboxedModule = require('sandboxed-module')

describe "ClsiManager", ->
	beforeEach ->
		@ClsiManager = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @settings =
				apis:
					filestore:
						url: "filestore.example.com"
						secret: "secret"
					clsi:
						url: "http://clsi.example.com"
			"../../models/Project": Project: @Project = {}
			"../Project/ProjectEntityHandler": @ProjectEntityHandler = {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
			"request": @request = {}
		@project_id = "project-id"
		@callback = sinon.stub()

	describe "sendRequest", ->
		beforeEach ->
			@ClsiManager._buildRequest = sinon.stub().callsArgWith(2, null, @request = "mock-request")

		describe "with a successful compile", ->
			beforeEach ->
				@ClsiManager._postToClsi = sinon.stub().callsArgWith(2, null, {
					compile:
						status: @status = "success"
						outputFiles: [{
							url: "#{@settings.apis.clsi.url}/project/#{@project_id}/output/output.pdf"
							type: "pdf"
						},{
							url: "#{@settings.apis.clsi.url}/project/#{@project_id}/output/output.log"
							type: "log"
						}]
				})
				@ClsiManager.sendRequest @project_id, {}, @callback

			it "should build the request", ->
				@ClsiManager._buildRequest
					.calledWith(@project_id)
					.should.equal true

			it "should send the request to the CLSI", ->
				@ClsiManager._postToClsi
					.calledWith(@project_id, @request)
					.should.equal true

			it "should call the callback with the status and output files", ->
				outputFiles = [{
					path: "output.pdf"
					type: "pdf"
				},{
					path: "output.log"
					type: "log"
				}]
				@callback.calledWith(null, @status, outputFiles).should.equal true

		describe "with a failed compile", ->
			beforeEach ->
				@ClsiManager._postToClsi = sinon.stub().callsArgWith(2, null, {
					compile:
						status: @status = "failure"
				})
				@ClsiManager.sendRequest @project_id, {}, @callback
			
			it "should call the callback with a failure statue", ->
				@callback.calledWith(null, @status).should.equal true

	describe "deleteAuxFiles", ->
		beforeEach ->
			@request.del = sinon.stub().callsArg(1)
			@ClsiManager.deleteAuxFiles @project_id, @callback

		it "should call the delete method in the CLSI", ->
			@request.del
				.calledWith("#{@settings.apis.clsi.url}/project/#{@project_id}")
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "_buildRequest", ->
		beforeEach ->
			@project =
				_id: @project_id
				compiler: @compiler = "latex"
				rootDoc_id: "mock-doc-id-1"

			@docs = {
				"/main.tex": @doc_1 = {
					name: "main.tex"
					_id: "mock-doc-id-1"
					lines: ["Hello", "world"]
				},
				"/chapters/chapter1.tex": @doc_2 = {
					name: "chapter1.tex"
					_id: "mock-doc-id-2"
					lines: [
						"Chapter 1"
					]
				}
			}

			@files = {
				"/images/image.png": @file_1 = {
					name: "image.png"
					_id:  "mock-file-id-1"
					created: new Date()
				}
			}

			@Project.findById = sinon.stub().callsArgWith(2, null, @project)
			@ProjectEntityHandler.getAllDocs = sinon.stub().callsArgWith(1, null, @docs)
			@ProjectEntityHandler.getAllFiles = sinon.stub().callsArgWith(1, null, @files)

		describe "with a valid project", ->
			beforeEach (done) ->
				@ClsiManager._buildRequest @project_id, null, (error, request) =>
					@request = request
					done()

			it "should get the project with the required fields", ->
				@Project.findById
					.calledWith(@project_id, {compiler:1, rootDoc_id: 1})
					.should.equal true

			it "should get all the docs", ->
				@ProjectEntityHandler.getAllDocs
					.calledWith(@project_id)
					.should.equal true

			it "should get all the files", ->
				@ProjectEntityHandler.getAllFiles
					.calledWith(@project_id)
					.should.equal true

			it "should build up the CLSI request", ->
				expect(@request).to.deep.equal(
					compile:
						options:
							compiler: @compiler
						rootResourcePath: "main.tex"
						resources: [{
							path:    "main.tex"
							content: @doc_1.lines.join("\n")
						}, {
							path:    "chapters/chapter1.tex"
							content: @doc_2.lines.join("\n")
						}, {
							path: "images/image.png"
							url:  "#{@settings.apis.filestore.url}/project/#{@project_id}/file/#{@file_1._id}"
							modified: @file_1.created.getTime()
						}]
				)


		describe "when root doc override is valid", ->
			beforeEach (done) ->
				@ClsiManager._buildRequest @project_id, {rootDoc_id:"mock-doc-id-2"}, (error, request) =>
					@request = request
					done()

			it "should change root path", ->
				@request.compile.rootResourcePath.should.equal "chapters/chapter1.tex"


		describe "when root doc override is invalid", ->
			beforeEach (done) ->
				@ClsiManager._buildRequest @project_id, {rootDoc_id:"invalid-id"}, (error, request) =>
					@request = request
					done()

			it "should fallback to default root doc", ->
				@request.compile.rootResourcePath.should.equal "main.tex"



		describe "when the project has an invalid compiler", ->
			beforeEach (done) ->
				@project.compiler = "context"
				@ClsiManager._buildRequest @project, null, (error, request) =>
					@request = request
					done()

			it "should set the compiler to pdflatex", ->
				@request.compile.options.compiler.should.equal "pdflatex"

		describe "when there is no valid root document", ->
			beforeEach (done) ->
				@project.rootDoc_id = "not-valid"
				@ClsiManager._buildRequest @project, null, (@error, @request) =>
					done()
			
			it "should return an error", ->
				expect(@error).to.exist


	describe '_postToClsi', ->
		beforeEach ->
			@req = { mock: "req" }

		describe "successfully", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, {statusCode: 204}, @body = { mock: "foo" })
				@ClsiManager._postToClsi @project_id, @req, @callback

			it 'should send the request to the CLSI', ->
				url = "#{@settings.apis.clsi.url}/project/#{@project_id}/compile"
				@request.post.calledWith({
					url: url
					json: @req
					jar: false
				}).should.equal true

			it "should call the callback with the body and no error", ->
				@callback.calledWith(null, @body).should.equal true

		describe "when the CLSI returns an error", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, {statusCode: 500}, @body = { mock: "foo" })
				@ClsiManager._postToClsi @project_id, @req, @callback

			it "should call the callback with the body and the error", ->
				@callback.calledWith(new Error("CLSI returned non-success code: 500"), @body).should.equal true

