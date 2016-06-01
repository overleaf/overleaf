require('coffee-script')
assert = require('assert')
path = require('path')
modulePath = path.join __dirname, '../../../../app/js/RedisManager.js'
keys = require(path.join __dirname, '../../../../app/js/RedisKeyBuilder.js')
project_id = 1234
doc_id     = 5678
SandboxedModule = require('sandboxed-module')

describe 'RedisManager.putDocInMemory', ()->
	lines = ["this is one line", "and another line"]
	version = 42

	potentialSets = {}
	potentialSets[keys.docLines(doc_id:doc_id)] = lines
	potentialSets[keys.projectKey(doc_id:doc_id)] = project_id
	potentialSets[keys.docVersion(doc_id:doc_id)] = version

	potentialSAdds = {}
	potentialSAdds[keys.docsInProject(project_id:project_id)] = doc_id

	rclient =
		auth:->
		set:(key, value)->
			result = potentialSets[key]
			delete potentialSets[key]
			if key == keys.docLines(doc_id:doc_id)
				value = JSON.parse(value)
			assert.deepEqual result, value
		incr:()->
		sadd:(key, value, cb)->
			result = potentialSAdds[key]
			delete potentialSAdds[key]
			assert.equal result, value
			cb()
		del: (key) ->
			result = potentialDels[key]
			delete potentialDels[key]
			assert.equal result, true
		exec:(callback)->
			callback()
	rclient.multi = () -> rclient
	mocks =
		"./ZipManager": {}
		"logger-sharelatex": log:->
		"redis-sharelatex":
			createClient : () -> rclient
	
	redisManager = SandboxedModule.require(modulePath, requires: mocks)

	it 'should put a all data into memory', (done)->
		redisManager.putDocInMemory project_id, doc_id, lines, version, ()->
			assert.deepEqual potentialSets, {}
			assert.deepEqual potentialSAdds, {}
			done()

