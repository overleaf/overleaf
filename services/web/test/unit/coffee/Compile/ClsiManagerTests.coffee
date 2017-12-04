sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Compile/ClsiManager.js"
SandboxedModule = require('sandboxed-module')

describe "ClsiManager", ->
	beforeEach ->
		@jar = {cookie:"stuff"}
		@ClsiCookieManager = 
			getCookieJar: sinon.stub().callsArgWith(1, null, @jar)
			setServerId: sinon.stub().callsArgWith(2)
			_getServerId:sinon.stub()
		@ClsiStateManager =
			computeHash: sinon.stub().callsArgWith(2, null, "01234567890abcdef")
		@ClsiFormatChecker =
			checkRecoursesForProblems:sinon.stub().callsArgWith(1)
		@ClsiManager = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @settings =
				apis:
					filestore:
						url: "filestore.example.com"
						secret: "secret"
					clsi:
						url: "http://clsi.example.com"
					clsi_priority:
						url: "https://clsipremium.example.com"
			"../../models/Project": Project: @Project = {}
			"../Project/ProjectEntityHandler": @ProjectEntityHandler = {}
			"../Project/ProjectGetter": @ProjectGetter = {}
			"../DocumentUpdater/DocumentUpdaterHandler": @DocumentUpdaterHandler =
				getProjectDocsIfMatch: sinon.stub().callsArgWith(2,null,null)
			"./ClsiCookieManager": @ClsiCookieManager
			"./ClsiStateManager": @ClsiStateManager
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub(), err: sinon.stub(), warn: sinon.stub() }
			"request": @request = sinon.stub()
			"./ClsiFormatChecker": @ClsiFormatChecker
			"metrics-sharelatex": @Metrics =
				Timer: class Timer
					done: sinon.stub()
				inc: sinon.stub()
		@project_id = "project-id"
		@user_id = "user-id"
		@callback = sinon.stub()

	describe "sendRequest", ->
		beforeEach ->
			@ClsiManager._buildRequest = sinon.stub().callsArgWith(2, null, @request = "mock-request")
			@ClsiCookieManager._getServerId.callsArgWith(1, null, "clsi3")

		describe "with a successful compile", ->
			beforeEach ->
				@ClsiManager._postToClsi = sinon.stub().callsArgWith(4, null, {
					compile:
						status: @status = "success"
						outputFiles: [{
							url: "#{@settings.apis.clsi.url}/project/#{@project_id}/user/#{@user_id}/build/1234/output/output.pdf"
							path: "output.pdf"
							type: "pdf"
							build: 1234
						},{
							url: "#{@settings.apis.clsi.url}/project/#{@project_id}/user/#{@user_id}/build/1234/output/output.log"
							path: "output.log"
							type: "log"
							build: 1234
						}]
				})
				@ClsiManager.sendRequest @project_id, @user_id, {compileGroup:"standard"}, @callback

			it "should build the request", ->
				@ClsiManager._buildRequest
					.calledWith(@project_id)
					.should.equal true

			it "should send the request to the CLSI", ->
				@ClsiManager._postToClsi
					.calledWith(@project_id, @user_id, @request, "standard")
					.should.equal true

			it "should call the callback with the status and output files", ->
				outputFiles = [{
					url: "/project/#{@project_id}/user/#{@user_id}/build/1234/output/output.pdf"
					path: "output.pdf"
					type: "pdf"
					build: 1234
				},{
					url: "/project/#{@project_id}/user/#{@user_id}/build/1234/output/output.log"
					path: "output.log"
					type: "log"
					build: 1234
				}]
				@callback.calledWith(null, @status, outputFiles).should.equal true

		describe "with a failed compile", ->
			beforeEach ->
				@ClsiManager._postToClsi = sinon.stub().callsArgWith(4, null, {
					compile:
						status: @status = "failure"
				})
				@ClsiManager.sendRequest @project_id, @user_id, {}, @callback
			
			it "should call the callback with a failure statue", ->
				@callback.calledWith(null, @status).should.equal true

		describe "with a sync conflict", ->
			beforeEach ->
				@ClsiManager.sendRequestOnce = sinon.stub()
				@ClsiManager.sendRequestOnce.withArgs(@project_id, @user_id, {syncType:"full"}).callsArgWith(3, null,	@status = "success")
				@ClsiManager.sendRequestOnce.withArgs(@project_id, @user_id, {}).callsArgWith(3, null, "conflict")
				@ClsiManager.sendRequest @project_id, @user_id, {}, @callback

			it "should call the sendRequestOnce method twice", ->
				@ClsiManager.sendRequestOnce.calledTwice.should.equal true

			it "should call the sendRequestOnce method with syncType:full", ->
				@ClsiManager.sendRequestOnce.calledWith(@project_id, @user_id, {syncType:"full"}).should.equal true

			it "should call the sendRequestOnce method without syncType:full", ->
				@ClsiManager.sendRequestOnce.calledWith(@project_id, @user_id, {}).should.equal true

			it "should call the callback with a success status", ->
				@callback.calledWith(null, @status, ).should.equal true

		describe "when the resources fail the precompile check", ->
			beforeEach ->
				@ClsiFormatChecker.checkRecoursesForProblems = sinon.stub().callsArgWith(1, new Error("failed"))
				@ClsiManager._postToClsi = sinon.stub().callsArgWith(4, null, {
					compile:
						status: @status = "failure"
				})
				@ClsiManager.sendRequest @project_id, @user_id, {}, @callback

			it "should call the callback only once", ->
				@callback.calledOnce.should.equal true

			it "should call the callback with an error", ->
				@callback.calledWithExactly(new Error("failed")).should.equal true

	describe "deleteAuxFiles", ->
		beforeEach ->
			@ClsiManager._makeRequest = sinon.stub().callsArg(2)
			@DocumentUpdaterHandler.clearProjectState = sinon.stub().callsArg(1)
			
		describe "with the standard compileGroup", ->
			beforeEach ->
				@ClsiManager.deleteAuxFiles @project_id, @user_id, {compileGroup: "standard"}, @callback

			it "should call the delete method in the standard CLSI", ->
				@ClsiManager._makeRequest
					.calledWith(@project_id, { method:"DELETE", url:"#{@settings.apis.clsi.url}/project/#{@project_id}/user/#{@user_id}"})
					.should.equal true

			it "should clear the project state from the docupdater", ->
				@DocumentUpdaterHandler.clearProjectState
					.calledWith(@project_id)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true
				

	describe "_buildRequest", ->
		beforeEach ->
			@project =
				_id: @project_id
				compiler: @compiler = "latex"
				rootDoc_id: "mock-doc-id-1"
				imageName: @image = "mock-image-name"

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
			@ProjectGetter.getProject = sinon.stub().callsArgWith(2, null, @project)
			@DocumentUpdaterHandler.flushProjectToMongo = sinon.stub().callsArgWith(1, null)

		describe "with a valid project", ->
			beforeEach (done) ->
				@ClsiManager._buildRequest @project_id, {timeout:100}, (error, request) =>
					@request = request
					done()

			it "should get the project with the required fields", ->
				@ProjectGetter.getProject
					.calledWith(@project_id, {compiler:1, rootDoc_id: 1, imageName: 1, rootFolder: 1})
					.should.equal true

			it "should flush the project to the database", ->
				@DocumentUpdaterHandler.flushProjectToMongo
					.calledWith(@project_id)
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
							timeout : 100
							imageName: @image
							draft: false
							check: undefined
							syncType: undefined # "full"
							syncState: undefined # "01234567890abcdef"
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

		describe "with the incremental compile option", ->
			beforeEach (done) ->
				@ClsiStateManager.computeHash = sinon.stub().callsArgWith(2, null, @project_state_hash = "01234567890abcdef")
				@DocumentUpdaterHandler.getProjectDocsIfMatch = sinon.stub().callsArgWith(2, null, [{_id:@doc_1._id, lines:  @doc_1.lines, v: 123}])
				@ProjectEntityHandler.getAllDocPathsFromProject = sinon.stub().callsArgWith(1, null, {"mock-doc-id-1":"main.tex"})
				@ClsiManager._buildRequest @project_id, {timeout:100, incrementalCompilesEnabled:true}, (error, request) =>
					@request = request
					done()

			it "should get the project with the required fields", ->
				@ProjectGetter.getProject
					.calledWith(@project_id, {compiler:1, rootDoc_id: 1, imageName: 1, rootFolder: 1})
					.should.equal true

			it "should not explicitly flush the project to the database", ->
				@DocumentUpdaterHandler.flushProjectToMongo
					.calledWith(@project_id)
					.should.equal false

			it "should get only the live docs from the docupdater with a background flush in docupdater", ->
				@DocumentUpdaterHandler.getProjectDocsIfMatch
					.calledWith(@project_id)
					.should.equal true

			it "should not get any of the files", ->
				@ProjectEntityHandler.getAllFiles
					.called.should.equal false

			it "should build up the CLSI request", ->
				expect(@request).to.deep.equal(
					compile:
						options:
							compiler: @compiler
							timeout : 100
							imageName: @image
							draft: false
							check: undefined
							syncType: "incremental"
							syncState: "01234567890abcdef"
						rootResourcePath: "main.tex"
						resources: [{
							path:    "main.tex"
							content: @doc_1.lines.join("\n")
						}]
				)


			describe "when the root doc is set and not in the docupdater", ->
				beforeEach (done) ->
					@ClsiStateManager.computeHash = sinon.stub().callsArgWith(2, null, @project_state_hash = "01234567890abcdef")
					@DocumentUpdaterHandler.getProjectDocsIfMatch = sinon.stub().callsArgWith(2, null, [{_id:@doc_1._id, lines:  @doc_1.lines, v: 123}])
					@ProjectEntityHandler.getAllDocPathsFromProject = sinon.stub().callsArgWith(1, null, {"mock-doc-id-1":"main.tex", "mock-doc-id-2":"/chapters/chapter1.tex"})
					@ClsiManager._buildRequest @project_id, {timeout:100, incrementalCompilesEnabled:true, rootDoc_id:"mock-doc-id-2"}, (error, request) =>
						@request = request
						done()

				it "should still change the root path", ->
					@request.compile.rootResourcePath.should.equal "chapters/chapter1.tex"

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

			it "should set to main.tex", ->
				@request.compile.rootResourcePath.should.equal "main.tex"

		describe "when there is no valid root document and no main.tex document", ->
			beforeEach () ->
				@project.rootDoc_id = "not-valid"
				@docs = {
					"/other.tex": @doc_1 = {
						name: "other.tex"
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
				@ProjectEntityHandler.getAllDocs = sinon.stub().callsArgWith(1, null, @docs)
				@ClsiManager._buildRequest @project, null, @callback

			it "should report an error", ->
				@callback.calledWith(new Error("no main file specified")).should.equal true


		describe "when there is no valid root document and a single document which is not main.tex", ->
			beforeEach (done) ->
				@project.rootDoc_id = "not-valid"
				@docs = {
					"/other.tex": @doc_1 = {
						name: "other.tex"
						_id: "mock-doc-id-1"
						lines: ["Hello", "world"]
					}
				}
				@ProjectEntityHandler.getAllDocs = sinon.stub().callsArgWith(1, null, @docs)
				@ClsiManager._buildRequest @project, null, (@error, @request) =>
					done()

			it "should set io to the only file", ->
				@request.compile.rootResourcePath.should.equal "other.tex"


		describe "with the draft option", ->
			it "should add the draft option into the request", (done) ->
				@ClsiManager._buildRequest @project_id, {timeout:100, draft: true}, (error, request) =>
					request.compile.options.draft.should.equal true
					done()


	describe '_postToClsi', ->
		beforeEach ->
			@req = { mock: "req" }

		describe "successfully", ->
			beforeEach ->
				@ClsiManager._makeRequest = sinon.stub().callsArgWith(2, null, {statusCode: 204}, @body = { mock: "foo" })
				@ClsiManager._postToClsi @project_id, @user_id, @req, "standard", @callback

			it 'should send the request to the CLSI', ->
				url = "#{@settings.apis.clsi.url}/project/#{@project_id}/user/#{@user_id}/compile"
				@ClsiManager._makeRequest.calledWith(@project_id, {
					method: "POST",
					url: url
					json: @req
				}).should.equal true

			it "should call the callback with the body and no error", ->
				@callback.calledWith(null, @body).should.equal true

		describe "when the CLSI returns an error", ->
			beforeEach ->
				@ClsiManager._makeRequest = sinon.stub().callsArgWith(2, null, {statusCode: 500}, @body = { mock: "foo" })
				@ClsiManager._postToClsi @project_id, @user_id, @req, "standard", @callback

			it "should call the callback with the body and the error", ->
				@callback.calledWith(new Error("CLSI returned non-success code: 500"), @body).should.equal true


	describe "wordCount", ->
		beforeEach ->
			@ClsiManager._makeRequest = sinon.stub().callsArgWith(2, null, {statusCode: 200}, @body = { mock: "foo" })
			@ClsiManager._buildRequest = sinon.stub().callsArgWith(2, null, @req = { compile: { rootResourcePath: "rootfile.text", options: {} } })

		describe "with root file", ->
			beforeEach ->
				@ClsiManager.wordCount @project_id, @user_id, false, {}, @callback

			it "should call wordCount with root file", ->
				@ClsiManager._makeRequest
				.calledWith(@project_id, {method: "GET", url: "http://clsi.example.com/project/#{@project_id}/user/#{@user_id}/wordcount", qs: {file: "rootfile.text",image:undefined}})
				.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true
				
		describe "with param file", ->
			beforeEach ->
				@ClsiManager.wordCount @project_id, @user_id, "main.tex", {}, @callback

			it "should call wordCount with param file", ->
				@ClsiManager._makeRequest
					.calledWith(@project_id, { method: "GET", url: "http://clsi.example.com/project/#{@project_id}/user/#{@user_id}/wordcount", qs:{file:"main.tex",image:undefined}})
					.should.equal true
					
		describe "with image", ->
			beforeEach ->
				@req.compile.options.imageName = @image = "example.com/mock/image"
				@ClsiManager.wordCount @project_id, @user_id, "main.tex", {}, @callback

			it "should call wordCount with file and image", ->
				@ClsiManager._makeRequest
					.calledWith(@project_id, { method: "GET", url: "http://clsi.example.com/project/#{@project_id}/user/#{@user_id}/wordcount", qs:{file:"main.tex",image:@image}})
					.should.equal true



	describe "_makeRequest", ->

		beforeEach ->
			@response = {there:"something"}
			@request.callsArgWith(1, null, @response)
			@opts = 
				method: "SOMETHIGN"
				url: "http://a place on the web"

		it "should process a request with a cookie jar", (done)->
			@ClsiManager._makeRequest @project_id, @opts, =>
				args = @request.args[0]
				args[0].method.should.equal @opts.method
				args[0].url.should.equal @opts.url
				args[0].jar.should.equal @jar
				done()

		it "should set the cookie again on response as it might have changed", (done)->
			@ClsiManager._makeRequest @project_id, @opts, =>
				@ClsiCookieManager.setServerId.calledWith(@project_id, @response).should.equal true
				done()






