sinon = require('sinon')
assert = require('assert')
path = require('path')
modulePath = path.join __dirname, '../../../../../app/js/infrastructure/LockManager.js'
project_id = 1234
doc_id     = 5678
SandboxedModule = require('sandboxed-module')

describe 'LockManager - releasing the lock', ()->

	deleteStub = sinon.stub().callsArgWith(1)
	mocks =
		"logger-sharelatex": log:->

		"redis-sharelatex":
			createClient : ()->
				auth:->
				del:deleteStub
	
	LockManager = SandboxedModule.require(modulePath, requires: mocks)

	it 'should put a all data into memory', (done)->
		LockManager.releaseLock doc_id, ->
			deleteStub.calledWith("Blocking:#{doc_id}").should.equal true
			done()

