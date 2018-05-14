sinon = require('sinon')
assert = require('assert')
path = require('path')
modulePath = path.join __dirname, '../../../../../app/js/infrastructure/LockManager.js'
lockKey = "lock:web:{#{5678}}"
lockValue = "123456"
SandboxedModule = require('sandboxed-module')

describe 'LockManager - releasing the lock', ()->

	deleteStub = sinon.stub().callsArgWith(4)
	mocks =
		"logger-sharelatex": log:->

		"./RedisWrapper":
			client: ()->
				auth:->
				eval:deleteStub

	LockManager = SandboxedModule.require(modulePath, requires: mocks)
	LockManager.unlockScript = "this is the unlock script"
	
	it 'should put a all data into memory', (done)->
		LockManager._releaseLock lockKey, lockValue, ->
			deleteStub.calledWith(LockManager.unlockScript, 1, lockKey, lockValue).should.equal true
			done()

