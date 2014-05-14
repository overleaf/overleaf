require('coffee-script')
_ = require("underscore")
assert = require('assert')
sinon = require('sinon')
path = require('path')
modulePath = path.join __dirname, '../../../app/js/RedisManager.js'
keys = require(path.join __dirname, '../../../app/js/RedisKeyBuilder.js')
SandboxedModule = require('sandboxed-module')

describe 'removing single doc from memory', ()->

	project_id = "12345"
	doc_id1     = "docid1"
	doc_id2     = "docid2"
	doc_id3     = "docid3"
	
	redisMemory = undefined
	redisManager = undefined
	self = @
	beforeEach (done)->
		redisMemory = {}

		mocks =
			"logger-sharelatex":
				error:->
				log:->
			redis:
				createClient : ->
					auth:->
					multi: ->
						get:->
						set:(key, value)->
							redisMemory[key] = value
						sadd:(key, value)->
							if !redisMemory[key]?
								redisMemory[key] = []
							redisMemory[key].push value
						del : (key)->
							delete redisMemory[key]
						srem : (key, member)->
							index = redisMemory[key].indexOf(member)
							redisMemory[key].splice(index, 1)
						exec:(callback)->
							callback(null, [])
		
		redisManager = SandboxedModule.require(modulePath, requires: mocks)
		redisManager.putDocInMemory project_id, doc_id1, 0, ["line"], ->
			redisManager.putDocInMemory project_id, doc_id2, 0, ["ledf"], ->
				redisManager.putDocInMemory project_id, doc_id3, 0, ["ledf"], ->
					done()

	it 'should remove doc lines from memory', (done)->
		keyExists = false
		redisManager.removeDocFromMemory project_id, doc_id1, ()->
			assert.equal redisMemory[keys.docLines(doc_id:doc_id1)], undefined
			keys = _.keys(redisMemory)
			containsKey(keys, doc_id1)
			keys.forEach (sets)->
				containsKey sets, doc_id1
			_.each redisMemory, (value)->
				if value.indexOf(doc_id1) != -1
					assert.equal false, "#{doc_id1} found in value #{value}"
			done()


containsKey = (haystack, key)->
	if haystack.forEach?
		haystack.forEach (area)->
			if area.indexOf(key) != -1
				assert.equal false, "#{key} found in haystack in #{area}"



