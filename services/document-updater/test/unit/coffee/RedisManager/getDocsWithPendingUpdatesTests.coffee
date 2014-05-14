sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/RedisManager"
SandboxedModule = require('sandboxed-module')

describe "RedisManager.getDocsWithPendingUpdates", ->
	beforeEach ->
		@callback = sinon.stub()
		@RedisManager = SandboxedModule.require modulePath, requires:
			"redis" : createClient: () =>
				@rclient = auth:->
			"logger-sharelatex": {}

		@docs = [{
			doc_id: "doc-id-1"
			project_id: "project-id-1"
		}, {
			doc_id: "doc-id-2"
			project_id: "project-id-2"
		}]
		@doc_keys = @docs.map (doc) -> "#{doc.project_id}:#{doc.doc_id}"

		@rclient.smembers = sinon.stub().callsArgWith(1, null, @doc_keys)
		@RedisManager.getDocsWithPendingUpdates(@callback)

	it "should get the docs with pending updates", ->
		@rclient.smembers
			.calledWith("DocsWithPendingUpdates")
			.should.equal true
	
	it "should return the docs with pending updates", ->
		@callback.calledWith(null, @docs).should.equal true

