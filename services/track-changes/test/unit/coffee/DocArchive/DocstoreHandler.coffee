chai = require('chai')
chai.should()
sinon = require("sinon")
modulePath = "../../../../app/js/DocstoreHandler.js"
SandboxedModule = require('sandboxed-module')

describe "DocstoreHandler", ->
	beforeEach ->
		@requestDefaults = sinon.stub().returns(@request = sinon.stub())
		@DocstoreHandler = SandboxedModule.require modulePath, requires:
			"request" : defaults: @requestDefaults
			"settings-sharelatex": @settings =
				apis:
					docstore:
						url: "docstore.sharelatex.com"
			"logger-sharelatex": @logger = {log: sinon.stub(), error: sinon.stub(), err:->}

		@requestDefaults.calledWith(jar: false).should.equal true

		@project_id = "project-id-123"
		@doc_id = "doc-id-123"
		@callback = sinon.stub()
		
	describe "getAllDocs", ->
		describe "with a successful response code", ->
			beforeEach ->
				@request.get = sinon.stub().callsArgWith(1, null, statusCode: 204, @docs = [{ _id: "mock-doc-id" }])
				@DocstoreHandler.getAllDocs @project_id, @callback

			it "should get all the project docs in the docstore api", ->
				@request.get
					.calledWith({
						url: "#{@settings.apis.docstore.url}/project/#{@project_id}/doc"
						json: true
					})
					.should.equal true

			it "should call the callback with the docs", ->
				@callback.calledWith(null, @docs).should.equal true

		describe "with a failed response code", ->
			beforeEach ->
				@request.get = sinon.stub().callsArgWith(1, null, statusCode: 500, "")
				@DocstoreHandler.getAllDocs @project_id, @callback

			it "should call the callback with an error", ->
				@callback.calledWith(new Error("docstore api responded with non-success code: 500")).should.equal true

			it "should log the error", ->
				@logger.error
					.calledWith({
						err: new Error("docstore api responded with a non-success code: 500")
						project_id: @project_id
					}, "error getting all docs from docstore")
					.should.equal true