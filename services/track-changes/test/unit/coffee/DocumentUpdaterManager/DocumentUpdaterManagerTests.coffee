sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/DocumentUpdaterManager.js"
SandboxedModule = require('sandboxed-module')

describe "DocumentUpdaterManager", ->
	beforeEach ->
		@DocumentUpdaterManager = SandboxedModule.require modulePath, requires:
			"request": @request = {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
			'settings-sharelatex': @settings =
				apis : documentupdater: url : "http://example.com"
		@callback = sinon.stub()
		@lines = ["one", "two", "three"]
		@version = 42

	describe "getDocument", ->
		describe "successfully", ->
			beforeEach ->
				@body = JSON.stringify
					lines: @lines
					version: @version
					ops: []
				@request.get = sinon.stub().callsArgWith(1, null, {statusCode: 200}, @body)
				@DocumentUpdaterManager.getDocument @project_id, @doc_id, @callback

			it 'should get the document from the document updater', ->
				url = "#{@settings.apis.documentupdater.url}/project/#{@project_id}/doc/#{@doc_id}"
				@request.get.calledWith(url).should.equal true

			it "should call the callback with the content and version", ->
				@callback.calledWith(null, @lines.join("\n"), @version).should.equal true

		describe "when the document updater API returns an error", ->
			beforeEach ->
				@request.get = sinon.stub().callsArgWith(1, @error = new Error("something went wrong"), null, null)
				@DocumentUpdaterManager.getDocument @project_id, @doc_id, @callback

			it "should return an error to the callback", ->
				@callback.calledWith(@error).should.equal true

		describe "when the document updater returns a failure error code", ->
			beforeEach ->
				@request.get = sinon.stub().callsArgWith(1, null, { statusCode: 500 }, "")
				@DocumentUpdaterManager.getDocument @project_id, @doc_id, @callback

			it "should return the callback with an error", ->
				@callback
					.calledWith(sinon.match.has('message', "doc updater returned a non-success status code: 500"))
					.should.equal true

	describe "setDocument", ->
		beforeEach ->
			@content = "mock content"
			@user_id = "user-id-123"

		describe "successfully", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, {statusCode: 200})
				@DocumentUpdaterManager.setDocument @project_id, @doc_id, @content, @user_id, @callback

			it 'should set the document in the document updater', ->
				url = "#{@settings.apis.documentupdater.url}/project/#{@project_id}/doc/#{@doc_id}"
				@request.post
					.calledWith({
						url: url
						json:
							lines: @content.split("\n")
							source: "restore"
							user_id: @user_id
							undoing: true
					}).should.equal true

			it "should call the callback", ->
				@callback.calledWith(null).should.equal true

		describe "when the document updater API returns an error", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, @error = new Error("something went wrong"), null, null)
				@DocumentUpdaterManager.setDocument @project_id, @doc_id, @content, @user_id, @callback

			it "should return an error to the callback", ->
				@callback.calledWith(@error).should.equal true

		describe "when the document updater returns a failure error code", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, { statusCode: 500 }, "")
				@DocumentUpdaterManager.setDocument @project_id, @doc_id, @content, @user_id, @callback

			it "should return the callback with an error", ->
				@callback
					.calledWith(sinon.match.has('message', "doc updater returned a non-success status code: 500"))
					.should.equal true
