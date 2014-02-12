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
			"logger-sharelatex": @logger = { log: sinon.stub() }
		@project_id = "project-id"
		@callback = sinon.stub()

	describe "sendRequest", ->
		beforeEach ->
			@Project.findById = sinon.stub().callsArgWith(1, null, @project = "mock-project")
			@ClsiManager._buildRequest = sinon.stub().callsArgWith(1, null, @request = "mock-request")

		describe "with a successful compile", ->
			beforeEach ->
				@ClsiManager._postToClsi = sinon.stub().callsArgWith(2, null, {
					compile:
						status: "success"
						outputFiles: [{
							url: "#{@settings.apis.clsi.url}/project/#{@project_id}/output/output.pdf"
							type: "pdf"
						},{
							url: "#{@settings.apis.clsi.url}/project/#{@project_id}/output/output.log"
							type: "log"
						}]
				})
				@ClsiManager.sendRequest @project_id, @callback

			it "should look up the project", ->
				@Project.findById
					.calledWith(@project_id)
					.should.equal true

			it "should convert the project to a request", ->
				@ClsiManager._buildRequest
					.calledWith(@project)
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
				@callback.calledWith(null, true, outputFiles).should.equal true

		describe "with a failed compile", ->
			beforeEach ->
				@ClsiManager._postToClsi = sinon.stub().callsArgWith(2, null, {
					compile:
						status: "failure"
				})
				@ClsiManager.sendRequest @project_id, @callback
			
			it "should call the callback with a failure statue", ->
				@callback.calledWith(null, false).should.equal true

	describe "_buildRequest", ->
		beforeEach ->
			@project =
				_id: @project_id
				compiler: @compiler = "latex"
				rootDoc_id: "mock-doc-id-1"
				rootFolder: [
					docs: [
						@doc_1 = {
							name: "main.tex"
							_id: "mock-doc-id-1"
							lines: ["Hello", "world"]
						}
					]
					fileRefs: []
					folders: [
						@chapters_folder = {
							name: "chapters"
							docs: [
								@doc_2 = {
									name: "chapter1.tex"
									_id: "mock-doc-id-2"
									lines: [
										"Chapter 1"
									]
								}
							]
							fileRefs: []
							folders: []
						},
						@images_folder = {
							name: "images"
							docs: []
							fileRefs: [
								@file_1 = {
									name: "image.png"
									_id:  "mock-file-id-1"
									created: new Date()
								}
							]
							folders: []
						}
					]

				]

		describe "with a valid project", ->
			beforeEach (done) ->
				@ClsiManager._buildRequest @project, (error, request) =>
					@request = request
					done()

			it "should build up the CLSI request", ->
				expect(@request).to.deep.equal(
					compile:
						options:
							compiler: @compiler
						rootResourcePath: "main.tex"
						resources: [{
							path:    @doc_1.name
							content: @doc_1.lines.join("\n")
						}, {
							path:    "#{@chapters_folder.name}/#{@doc_2.name}"
							content: @doc_2.lines.join("\n")
						}, {
							path: "#{@images_folder.name}/#{@file_1.name}"
							url:  "#{@settings.apis.filestore.url}/project/#{@project_id}/file/#{@file_1._id}"
							modified: @file_1.created.getTime()
						}]
				)

		describe "when the project has an invalid compiler", ->
			beforeEach (done) ->
				@project.compiler = "context"
				@ClsiManager._buildRequest @project, (error, request) =>
					@request = request
					done()

			it "should set the compiler to pdflatex", ->
				@request.compile.options.compiler.should.equal "pdflatex"

		describe "when there is no valid root document", ->
			beforeEach (done) ->
				@project.rootDoc_id = "not-valid"
				@ClsiManager._buildRequest @project, (@error, @request) =>
					done()
			
			it "should return an error", ->
				expect(@error).to.exist


