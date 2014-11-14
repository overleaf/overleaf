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
			redis: web: {}
		@rclient = {auth:->}
			
		@DocumentUpdaterManager = SandboxedModule.require modulePath, requires:
			'settings-sharelatex':@settings
			'logger-sharelatex': @logger = {log: sinon.stub(), error: sinon.stub()}
			'request': @request = {}
			'redis-sharelatex' : createClient: () => @rclient

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

	describe 'flushProjectToMongoAndDelete', ->
		beforeEach ->
			@callback = sinon.stub()

		describe "successfully", ->
			beforeEach ->
				@request.del = sinon.stub().callsArgWith(1, null, {statusCode: 204}, "")
				@DocumentUpdaterManager.flushProjectToMongoAndDelete @project_id, @callback

			it 'should delete the project from the document updater', ->
				url = "#{@settings.apis.documentupdater.url}/project/#{@project_id}"
				@request.del.calledWith(url).should.equal true

			it "should call the callback with no error", ->
				@callback.calledWith(null).should.equal true

		describe "when the document updater API returns an error", ->
			beforeEach ->
				@request.del = sinon.stub().callsArgWith(1, @error = new Error("something went wrong"), null, null)
				@DocumentUpdaterManager.flushProjectToMongoAndDelete @project_id, @callback

			it "should return an error to the callback", ->
				@callback.calledWith(@error).should.equal true

		describe "when the document updater returns a failure error code", ->
			beforeEach ->
				@request.del = sinon.stub().callsArgWith(1, null, { statusCode: 500 }, "")
				@DocumentUpdaterManager.flushProjectToMongoAndDelete @project_id, @callback

			it "should return the callback with an error", ->
				err = new Error("doc updater returned failure status code: 500")
				err.statusCode = 500
				@callback
					.calledWith(err)
					.should.equal true

	describe 'queueChange', ->
		beforeEach ->
			@change = {
				"action":"removeText",
				"range":{"start":{"row":2,"column":2},"end":{"row":2,"column":3}},
				"text":"e"
			}
			@rclient.multi = sinon.stub().returns @rclient
			@rclient.exec = sinon.stub().callsArg(0)
			@rclient.rpush = sinon.stub()
			@rclient.sadd = sinon.stub()
			@callback = sinon.stub()

		describe "successfully", ->
			beforeEach ->
				@DocumentUpdaterManager.queueChange(@project_id, @doc_id, @change, @callback)

			it "should push the change", ->
				@rclient.rpush
					.calledWith("PendingUpdates:#{@doc_id}", JSON.stringify(@change))
					.should.equal true

			it "should notify the doc updater of the change via the pending-updates-list queue", ->
				@rclient.rpush
					.calledWith("pending-updates-list", "#{@project_id}:#{@doc_id}")
					.should.equal true

			it "should push the doc id into the pending updates set", ->
				@rclient.sadd
					.calledWith("DocsWithPendingUpdates", "#{@project_id}:#{@doc_id}")
					.should.equal true

		describe "with error connecting to redis during exec", ->
			beforeEach ->
				@rclient.exec = sinon.stub().callsArgWith(0, new Error("something went wrong"))
				@DocumentUpdaterManager.queueChange(@project_id, @doc_id, @change, @callback)

			it "should return an error", ->
				@callback.calledWithExactly(sinon.match(Error)).should.equal true
