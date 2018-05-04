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
			"./RedisWrapper":
				client: () =>
					auth:->
					set: @set = sinon.stub()
			"settings-sharelatex":{redis:{}}
			"metrics-sharelatex": inc:->
		@callback = sinon.stub()
		@key = "lock:web:lockName:project-id}"
		@namespace = "lockName"

	describe "when the lock is not set", ->
		beforeEach ->
			@set.callsArgWith(5, null, "OK")
			@LockManager.randomLock = sinon.stub().returns("random-lock-value")
			@LockManager._tryLock @key, @namespace, @callback

		it "should set the lock key with an expiry if it is not set", ->
			@set.calledWith(@key, "random-lock-value", "EX", 30, "NX")
				.should.equal true

		it "should return the callback with true", ->
			@callback.calledWith(null, true).should.equal true

	describe "when the lock is already set", ->
		beforeEach ->
			@set.callsArgWith(5, null, null)
			@LockManager._tryLock @key, @namespace, @callback

		it "should return the callback with false", ->
			@callback.calledWith(null, false).should.equal true

