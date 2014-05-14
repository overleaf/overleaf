sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/RedisManager"
SandboxedModule = require('sandboxed-module')

describe "RedisManager.clearDocFromPendingUpdatesSet", ->
	beforeEach ->
		@project_id = "project-id"
		@doc_id = "document-id"
		@callback = sinon.stub()
		@RedisManager = SandboxedModule.require modulePath, requires:
			"redis" : createClient: () =>
				@rclient = auth:->
			"logger-sharelatex": {}

		@rclient.srem = sinon.stub().callsArg(2)
		@RedisManager.clearDocFromPendingUpdatesSet(@project_id, @doc_id, @callback)

	it "should get the docs with pending updates", ->
		@rclient.srem
			.calledWith("DocsWithPendingUpdates", "#{@project_id}:#{@doc_id}")
			.should.equal true
	
	it "should return the callback", ->
		@callback.called.should.equal true


