assert = require('assert')
should = require('chai').should()
path = require('path')
modulePath = path.join __dirname, '../../../app/js/RedisManager.js'
_ = require('underscore')
SandboxedModule = require('sandboxed-module')
keys = require(path.join __dirname, '../../../app/js/RedisKeyBuilder.js')

describe 'getting entire list of pending updates', ()->

	doc_id = 123
	redisMemory = {}
	correctUpdates = [{"update1"}, {"update2"}, {"update3"}]
	jsonCorrectUpdates = _.map correctUpdates, (d)-> JSON.stringify d
	redisMemory[keys.pendingUpdates(doc_id:doc_id)] = jsonCorrectUpdates
	redisMemory[keys.pendingUpdates(doc_id:"notThis")] = JSON.stringify([{"updatex"}, {"updatez"}])

	redisReturn = []

	mocks =
		redis:
			createClient: ()->
				auth:->
				multi: ()->
					lrange:(key, start, end)->
						key.should.equal(keys.pendingUpdates(doc_id:doc_id))
						start.should.equal(0)
						end.should.equal(-1)
						redisReturn.push(redisMemory[key])
					del : (key)->
						key.should.equal(keys.pendingUpdates(doc_id:doc_id))
						redisReturn.push(1)
					exec: (callback)->
						callback(null, redisReturn)
	
	redisManager = SandboxedModule.require(modulePath, requires: mocks)

	it 'should have 3 elements in array', (done)->
		redisManager.getPendingUpdatesForDoc doc_id, (err, listOfUpdates)->
			listOfUpdates.length.should.equal(3)
			done()

