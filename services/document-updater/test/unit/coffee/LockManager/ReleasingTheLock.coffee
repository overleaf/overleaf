require('coffee-script')
sinon = require('sinon')
assert = require('assert')
path = require('path')
modulePath = path.join __dirname, '../../../../app/js/LockManager.js'
project_id = 1234
doc_id     = 5678
SandboxedModule = require('sandboxed-module')

describe 'LockManager - releasing the lock', ()->

	evalStub = sinon.stub().yields(1)
	mocks =
		"logger-sharelatex": log:->
		"./RedisKeyBuilder":
			blockingKey: ({doc_id}) -> "Blocking:#{doc_id}"
		"./RedisBackend":
			createClient : ()->
				auth:->
				eval: evalStub
		"./Metrics": {inc: () ->}
	
	LockManager = SandboxedModule.require(modulePath, requires: mocks)

	it 'should put a all data into memory', (done)->
		lockValue = "lock-value-stub"
		LockManager.releaseLock doc_id, lockValue, ->
			evalStub.calledWith(LockManager.unlockScript, 1, "Blocking:#{doc_id}", lockValue).should.equal true
			done()

