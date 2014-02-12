require('coffee-script')
sinon = require('sinon')
assert = require('assert')
path = require('path')
modulePath = path.join __dirname, '../../../../app/js/LockManager.js'
keys = require(path.join __dirname, '../../../../app/js/RedisKeyBuilder.js')
project_id = 1234
doc_id     = 5678
loadModule = require('../module-loader').loadModule

describe 'LockManager - releasing the lock', ()->

	deleteStub = sinon.stub().callsArgWith(1)
	mocks =
		"logger-sharelatex": log:->

		redis:
			createClient : ()->
				auth:->
				del:deleteStub
	
	LockManager = loadModule(modulePath, mocks).module.exports

	it 'should put a all data into memory', (done)->
		LockManager.releaseLock doc_id, ->
			deleteStub.calledWith("Blocking:#{doc_id}").should.equal true
			done()

