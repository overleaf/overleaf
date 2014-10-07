sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../app/js/RedisManager.js"
SandboxedModule = require('sandboxed-module')

describe 'RedisManager.getDoc', ->
	beforeEach ->
		@rclient = {}
		@rclient.auth = () ->
		@rclient.multi = () => @rclient

		@RedisManager = SandboxedModule.require modulePath, requires:
			"redis-sharelatex": @redis =
				createClient: () => @rclient

		@doc_id = "doc-id-123"
		@lines = ["one", "two", "three"]
		@jsonlines = JSON.stringify @lines
		@version = 42
		@callback = sinon.stub()

		@rclient.get = sinon.stub()
		@rclient.exec = sinon.stub().callsArgWith(0, null, [@jsonlines, @version])

		@RedisManager.getDoc @doc_id, @callback

	it "should get the lines from redis", ->
		@rclient.get
			.calledWith("doclines:#{@doc_id}")
			.should.equal true
	
	it "should get the version from", ->
		@rclient.get
			.calledWith("DocVersion:#{@doc_id}")
			.should.equal true

	it 'should return the document', ->
		@callback
			.calledWith(null, @lines, @version)
			.should.equal true
