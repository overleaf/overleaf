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
			redis: documentupdater:
				key_schema:
					pendingUpdates: ({doc_id}) -> "PendingUpdates:#{doc_id}"
			maxUpdateSize: 7 * 1024 * 1024
		@rclient = {auth:->}

		@DocumentUpdaterManager = SandboxedModule.require modulePath,
			requires:
				'settings-sharelatex':@settings
				'logger-sharelatex': @logger = {log: sinon.stub(), error: sinon.stub(), warn: sinon.stub()}
				'request': @request = {}
				'redis-sharelatex' : createClient: () => @rclient
				'metrics-sharelatex': @Metrics =
					summary: sinon.stub()
					Timer: class Timer
						done: () ->
			globals:
				JSON: @JSON = Object.create(JSON) # avoid modifying JSON object directly

	describe "getDocument", ->
		beforeEach ->
			@callback = sinon.stub()

		describe "successfully", ->
			beforeEach ->
				@body = JSON.stringify
					lines: @lines
					version: @version
					ops: @ops = ["mock-op-1", "mock-op-2"]
					ranges: @ranges = {"mock": "ranges"}
				@fromVersion = 2
				@request.get = sinon.stub().callsArgWith(1, null, {statusCode: 200}, @body)
				@DocumentUpdaterManager.getDocument @project_id, @doc_id, @fromVersion, @callback

			it 'should get the document from the document updater', ->
				url = "#{@settings.apis.documentupdater.url}/project/#{@project_id}/doc/#{@doc_id}?fromVersion=#{@fromVersion}"
				@request.get.calledWith(url).should.equal true

			it "should call the callback with the lines, version, ranges and ops", ->
				@callback.calledWith(null, @lines, @version, @ranges, @ops).should.equal true

		describe "when the document updater API returns an error", ->
			beforeEach ->
				@request.get = sinon.stub().callsArgWith(1, @error = new Error("something went wrong"), null, null)
				@DocumentUpdaterManager.getDocument @project_id, @doc_id, @fromVersion, @callback

			it "should return an error to the callback", ->
				@callback.calledWith(@error).should.equal true

		[404, 422].forEach (statusCode) ->
			describe "when the document updater returns a #{statusCode} status code", ->
				beforeEach ->
					@request.get = sinon.stub().callsArgWith(1, null, { statusCode }, "")
					@DocumentUpdaterManager.getDocument @project_id, @doc_id, @fromVersion, @callback

				it "should return the callback with an error", ->
					@callback.called.should.equal(true)
					err = @callback.getCall(0).args[0]
					err.should.have.property('statusCode', statusCode)
					err.should.have.property('message', "doc updater could not load requested ops")
					@logger.error.called.should.equal(false)
					@logger.warn.called.should.equal(true)

		describe "when the document updater returns a failure error code", ->
			beforeEach ->
				@request.get = sinon.stub().callsArgWith(1, null, { statusCode: 500 }, "")
				@DocumentUpdaterManager.getDocument @project_id, @doc_id, @fromVersion, @callback

			it "should return the callback with an error", ->
				@callback.called.should.equal(true)
				err = @callback.getCall(0).args[0]
				err.should.have.property('statusCode', 500)
				err.should.have.property('message', "doc updater returned a non-success status code: 500")
				@logger.error.called.should.equal(true)

	describe 'flushProjectToMongoAndDelete', ->
		beforeEach ->
			@callback = sinon.stub()

		describe "successfully", ->
			beforeEach ->
				@request.del = sinon.stub().callsArgWith(1, null, {statusCode: 204}, "")
				@DocumentUpdaterManager.flushProjectToMongoAndDelete @project_id, @callback

			it 'should delete the project from the document updater', ->
				url = "#{@settings.apis.documentupdater.url}/project/#{@project_id}?background=true"
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
				@callback.called.should.equal(true)
				err = @callback.getCall(0).args[0]
				err.should.have.property('statusCode', 500)
				err.should.have.property('message', "document updater returned a failure status code: 500")

	describe 'queueChange', ->
		beforeEach ->
			@change = {
				"doc":"1234567890",
				"op":["d":"test", "p":345]
				"v": 789
			}
			@rclient.rpush = sinon.stub().yields()
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

		describe "with error talking to redis during rpush", ->
			beforeEach ->
				@rclient.rpush = sinon.stub().yields(new Error("something went wrong"))
				@DocumentUpdaterManager.queueChange(@project_id, @doc_id, @change, @callback)

			it "should return an error", ->
				@callback.calledWithExactly(sinon.match(Error)).should.equal true

		describe "with null byte corruption", ->
			beforeEach ->
				@JSON.stringify = () -> return '["bad bytes! \u0000 <- here"]'
				@DocumentUpdaterManager.queueChange(@project_id, @doc_id, @change, @callback)

			it "should return an error", ->
				@callback.calledWithExactly(sinon.match(Error)).should.equal true

			it "should not push the change onto the pending-updates-list queue", ->
				@rclient.rpush.called.should.equal false

		describe "when the update is too large", ->
			beforeEach ->
				@change = {op: {p: 12,t: "update is too large".repeat(1024 * 400)}}
				@DocumentUpdaterManager.queueChange(@project_id, @doc_id, @change, @callback)

			it "should return an error", ->
				@callback.calledWithExactly(sinon.match(Error)).should.equal true

			it "should add the size to the error", ->
				@callback.args[0][0].updateSize.should.equal 7782422

			it "should not push the change onto the pending-updates-list queue", ->
				@rclient.rpush.called.should.equal false

		describe "with invalid keys", ->
			beforeEach ->
				@change = {
					"op":["d":"test", "p":345]
					"version": 789 # not a valid key
				}
				@DocumentUpdaterManager.queueChange(@project_id, @doc_id, @change, @callback)

			it "should remove the invalid keys from the change", ->
				@rclient.rpush
					.calledWith("PendingUpdates:#{@doc_id}", JSON.stringify({op:@change.op}))
					.should.equal true
