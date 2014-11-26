sinon = require('sinon')
chai = require('chai')
should = chai.should()
path = require('path')
modulePath = path.join __dirname, '../../../../../app/js/infrastructure/LockManager.js'
SandboxedModule = require('sandboxed-module')

describe 'LockManager - trying the lock', ->
	beforeEach ->
		@LockManager = SandboxedModule.require modulePath, requires:
			"logger-sharelatex": log:->
			"redis-sharelatex":
				createClient : () =>
					auth:->
					set: @set = sinon.stub()
		@callback = sinon.stub()
		@doc_id = "doc-id-123"
	
	describe "when the lock is not set", ->
		beforeEach ->
			@set.callsArgWith(5, null, "OK")
			@LockManager.tryLock @doc_id, @callback

		it "should set the lock key with an expiry if it is not set", ->
			@set.calledWith("Blocking:#{@doc_id}", "locked", "EX", 30, "NX")
				.should.equal true

		it "should return the callback with true", ->
			@callback.calledWith(null, true).should.equal true

	describe "when the lock is already set", ->
		beforeEach ->
			@set.callsArgWith(5, null, null)
			@LockManager.tryLock @doc_id, @callback

		it "should return the callback with false", ->
			@callback.calledWith(null, false).should.equal true

