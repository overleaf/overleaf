require('coffee-script')
sinon = require('sinon')
assert = require('assert')
path = require('path')
modulePath = path.join __dirname, '../../../../../app/js/infrastructure/LockManager.js'
project_id = 1234
doc_id     = 5678
blockingKey = "Blocking:#{doc_id}"
SandboxedModule = require('sandboxed-module')

describe 'Lock Manager - checking the lock', ()->

	existsStub = sinon.stub()
	setStub = sinon.stub()
	exireStub = sinon.stub()
	execStub = sinon.stub()
	
	mocks =
		"logger-sharelatex": log:->

		"redis-sharelatex":
			createClient : ()->
				auth:->
				multi: ->
					exists: existsStub
					expire: exireStub
					set: setStub
					exec: execStub
	LockManager = SandboxedModule.require(modulePath, requires: mocks)

	it 'should check if lock exists but not set or expire', (done)->
		execStub.callsArgWith(0, null, ["1"])
		LockManager.checkLock doc_id, (err, docIsLocked)->
			existsStub.calledWith(blockingKey).should.equal true
			setStub.called.should.equal false
			exireStub.called.should.equal false
			done()

	it 'should return true if the key does not exists', (done)->
		execStub.callsArgWith(0, null, "0")
		LockManager.checkLock doc_id, (err, free)->
			free.should.equal true
			done()

	it 'should return false if the key does exists', (done)->
		execStub.callsArgWith(0, null, "1")
		LockManager.checkLock doc_id, (err, free)->
			free.should.equal false
			done()
