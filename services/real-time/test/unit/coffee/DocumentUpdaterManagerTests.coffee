require('chai').should()
sinon = require("sinon")
SandboxedModule = require('sandboxed-module')
path = require "path"
modulePath = '../../../app/js/DocumentUpdaterManager'

describe 'DocumentUpdaterManager', ->
	beforeEach ->
		@project_id = "project-id-923"
		@doc_id = "doc-id-394"
		@lines = ["one", "two", "three"]
		@version = 42
		@settings = 
			apis: documentupdater: url: "http://doc-updater.example.com"
			
		@DocumentUpdaterManager = SandboxedModule.require modulePath, requires:
			'settings-sharelatex':@settings
			'logger-sharelatex': @logger = {log: sinon.stub(), error: sinon.stub()}
			'request': @request = {}

	describe "getDocument", ->
		beforeEach ->
			@callback = sinon.stub()

		describe "successfully", ->
			beforeEach ->
				@body = JSON.stringify
					lines: @lines
					version: @version
					ops: @ops = ["mock-op-1", "mock-op-2"]
				@fromVersion = 2
				@request.get = sinon.stub().callsArgWith(1, null, {statusCode: 200}, @body)
				@DocumentUpdaterManager.getDocument @project_id, @doc_id, @fromVersion, @callback

			it 'should get the document from the document updater', ->
				url = "#{@settings.apis.documentupdater.url}/project/#{@project_id}/doc/#{@doc_id}?fromVersion=#{@fromVersion}"
				@request.get.calledWith(url).should.equal true

			it "should call the callback with the lines and version", ->
				@callback.calledWith(null, @lines, @version, @ops).should.equal true

		describe "when the document updater API returns an error", ->
			beforeEach ->
				@request.get = sinon.stub().callsArgWith(1, @error = new Error("something went wrong"), null, null)
				@DocumentUpdaterManager.getDocument @project_id, @doc_id, @fromVersion, @callback

			it "should return an error to the callback", ->
				@callback.calledWith(@error).should.equal true

		describe "when the document updater returns a failure error code", ->
			beforeEach ->
				@request.get = sinon.stub().callsArgWith(1, null, { statusCode: 500 }, "")
				@DocumentUpdaterManager.getDocument @project_id, @doc_id, @fromVersion, @callback

			it "should return the callback with an error", ->
				err = new Error("doc updater returned failure status code: 500")
				err.statusCode = 500
				@callback
					.calledWith(err)
					.should.equal true
