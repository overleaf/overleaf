chai = require('chai')
chai.should()
sinon = require("sinon")
modulePath = "../../../../app/js/Features/Docstore/DocstoreManager"
SandboxedModule = require('sandboxed-module')

describe "DocstoreManager", ->
	beforeEach ->
		@requestDefaults = sinon.stub().returns(@request = sinon.stub())
		@DocstoreManager = SandboxedModule.require modulePath, requires:
			"request" : defaults: @requestDefaults
			"settings-sharelatex": @settings =
				apis:
					docstore:
						url: "docstore.sharelatex.com"
			"logger-sharelatex": @logger = {log: sinon.stub(), error: sinon.stub()}

		@requestDefaults.calledWith(jar: false).should.equal true

		@project_id = "project-id-123"
		@doc_id = "doc-id-123"
		@callback = sinon.stub()

	describe "deleteDoc", ->
		describe "with a successful response code", ->
			beforeEach ->
				@request.del = sinon.stub().callsArgWith(1, null, statusCode: 204, "")
				@DocstoreManager.deleteDoc @project_id, @doc_id, @callback

			it "should delete the doc in the docstore api", ->
				@request.del
					.calledWith("#{@settings.apis.docstore.url}/project/#{@project_id}/doc/#{@doc_id}")
					.should.equal true

			it "should call the callback without an error", ->
				@callback.calledWith(null).should.equal true

		describe "with a failed response code", ->
			beforeEach ->
				@request.del = sinon.stub().callsArgWith(1, null, statusCode: 500, "")
				@DocstoreManager.deleteDoc @project_id, @doc_id, @callback

			it "should call the callback with an error", ->
				@callback.calledWith(new Error("docstore api responded with non-success code: 500")).should.equal true

			it "should log the error", ->
				@logger.error
					.calledWith({
						err: new Error("docstore api responded with a non-success code: 500")
						project_id: @project_id
						doc_id: @doc_id
					}, "error deleting doc in docstore")
					.should.equal true

	describe "updateDoc", ->
		beforeEach ->
			@lines = ["mock", "doc", "lines"]
			@rev = 5
			@modified = true

		describe "with a successful response code", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, statusCode: 204, { modified: @modified, rev: @rev })
				@DocstoreManager.updateDoc @project_id, @doc_id, @lines, @callback

			it "should update the doc in the docstore api", ->
				@request.post
					.calledWith({
						url: "#{@settings.apis.docstore.url}/project/#{@project_id}/doc/#{@doc_id}"
						json:
							lines: @lines
					})
					.should.equal true

			it "should call the callback with the modified status and revision", ->
				@callback.calledWith(null, @modified, @rev).should.equal true

		describe "with a failed response code", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, statusCode: 500, "")
				@DocstoreManager.updateDoc @project_id, @doc_id, @lines, @callback

			it "should call the callback with an error", ->
				@callback.calledWith(new Error("docstore api responded with non-success code: 500")).should.equal true

			it "should log the error", ->
				@logger.error
					.calledWith({
						err: new Error("docstore api responded with a non-success code: 500")
						project_id: @project_id
						doc_id: @doc_id
					}, "error updating doc in docstore")
					.should.equal true

	describe "getDoc", ->
		beforeEach ->
			@doc =
				lines:   @lines = ["mock", "doc", "lines"]
				rev:     @rev = 5

		describe "with a successful response code", ->
			beforeEach ->
				@request.get = sinon.stub().callsArgWith(1, null, statusCode: 204, @doc)
				@DocstoreManager.getDoc @project_id, @doc_id, @callback

			it "should get the doc from the docstore api", ->
				@request.get
					.calledWith({
						url: "#{@settings.apis.docstore.url}/project/#{@project_id}/doc/#{@doc_id}"
						json: true
					})
					.should.equal true

			it "should call the callback with the lines, version and rev", ->
				@callback.calledWith(null, @lines, @rev).should.equal true

		describe "with a failed response code", ->
			beforeEach ->
				@request.get = sinon.stub().callsArgWith(1, null, statusCode: 500, "")
				@DocstoreManager.getDoc @project_id, @doc_id, @callback

			it "should call the callback with an error", ->
				@callback.calledWith(new Error("docstore api responded with non-success code: 500")).should.equal true

			it "should log the error", ->
				@logger.error
					.calledWith({
						err: new Error("docstore api responded with a non-success code: 500")
						project_id: @project_id
						doc_id: @doc_id
					}, "error getting doc from docstore")
					.should.equal true

	describe "getAllDocs", ->
		describe "with a successful response code", ->
			beforeEach ->
				@request.get = sinon.stub().callsArgWith(1, null, statusCode: 204, @docs = [{ _id: "mock-doc-id" }])
				@DocstoreManager.getAllDocs @project_id, @callback

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
				@DocstoreManager.getAllDocs @project_id, @callback

			it "should call the callback with an error", ->
				@callback.calledWith(new Error("docstore api responded with non-success code: 500")).should.equal true

			it "should log the error", ->
				@logger.error
					.calledWith({
						err: new Error("docstore api responded with a non-success code: 500")
						project_id: @project_id
					}, "error getting all docs from docstore")
					.should.equal true
