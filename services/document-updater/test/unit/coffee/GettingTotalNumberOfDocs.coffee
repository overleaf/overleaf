require('coffee-script')
assert = require('assert')
should = require('chai').should()
path = require('path')
modulePath = path.join __dirname, '../../../app/js/RedisManager.js'
keys = require(path.join __dirname, '../../../app/js/RedisKeyBuilder.js')
SandboxedModule = require('sandboxed-module')

describe 'getting cound of docs from memory', ()->

	project_id = "12345"
	doc_id1     = "docid1"
	doc_id2     = "docid2"
	doc_id3     = "docid3"
	
	redisMemory = {}
	redisManager = undefined

	beforeEach (done)->
		mocks =
			"logger-sharelatex": log:->
			redis:
				createClient : ()->
					auth:->
					smembers:(key, callback)->
						callback(null, redisMemory[key])
					multi: ()->
						set:(key, value)->
							redisMemory[key] = value
						sadd:(key, value)->
							if !redisMemory[key]?
								redisMemory[key] = []
							redisMemory[key].push value
						del:()->
						exec:(callback)->
							callback()
		
		redisManager = SandboxedModule.require(modulePath, requires: mocks)
		redisManager.putDocInMemory project_id, doc_id1, 0, ["line"], ->
			redisManager.putDocInMemory project_id, doc_id2, 0, ["ledf"], ->
				redisManager.putDocInMemory project_id, doc_id3, 0, ["ledf"], ->
					done()

	it 'should return total', (done)->
		redisManager.getCountOfDocsInMemory (err, count)->
			assert.equal count, 3
			done()
