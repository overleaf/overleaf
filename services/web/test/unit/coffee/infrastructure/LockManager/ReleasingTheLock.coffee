sinon = require('sinon')
assert = require('assert')
path = require('path')
modulePath = path.join __dirname, '../../../../../app/js/infrastructure/LockManager.js'
lockKey = "lock:web:{#{5678}}"
SandboxedModule = require('sandboxed-module')

describe 'LockManager - releasing the lock', ()->

	deleteStub = sinon.stub().callsArgWith(1)
	mocks =
		"logger-sharelatex": log:->

		"./RedisWrapper":
			client: ()->
				auth:->
				del:deleteStub
	
	LockManager = SandboxedModule.require(modulePath, requires: mocks)

	it 'should put a all data into memory', (done)->
		LockManager._releaseLock lockKey, ->
			deleteStub.calledWith(lockKey).should.equal true
			done()

