require('coffee-script')
sinon = require('sinon')
assert = require('assert')
path = require('path')
modulePath = path.join __dirname, '../../../../app/js/LockManager.js'
project_id = 1234
doc_id     = 5678
blockingKey = "Blocking:#{doc_id}"
SandboxedModule = require('sandboxed-module')

describe 'LockManager - checking the lock', ()->

	existsStub = sinon.stub()
	
	mocks =
		"logger-sharelatex": log:->
		"redis-sharelatex":
			createClient : ()->
				auth:->
				exists: existsStub
		"./Metrics": {inc: () ->}
		"./Profiler": class Profiler
			log: sinon.stub().returns { end: sinon.stub() }
			end: sinon.stub()
	LockManager = SandboxedModule.require(modulePath, requires: mocks)

	it 'should return true if the key does not exists', (done)->
		existsStub.yields(null, "0")
		LockManager.checkLock doc_id, (err, free)->
			free.should.equal true
			done()

	it 'should return false if the key does exists', (done)->
		existsStub.yields(null, "1")
		LockManager.checkLock doc_id, (err, free)->
			free.should.equal false
			done()
