modulePath = "../../../app/js/Cache.js"
should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('chai').assert
path = require 'path'

user_token = "23ionisou90iilkn"
spellings = ["bob", "smith", "words"]

describe 'Cache', ->

	it 'should save the user into redis', (done)->
		@redis = 
			expire: (key, value)->
				key.should.equal "user-learned-words:#{user_token}"
				(value > 200).should.equal true
			set: (key, value)->
				key.should.equal "user-learned-words:#{user_token}"
				value.should.equal JSON.stringify(spellings)
			exec:->
				done()
		@cache = SandboxedModule.require modulePath, requires:
			'redis': createClient :=> {multi:=> @redis}

		@cache.set user_token, spellings, ->

	it 'should get the user from redis', (done)->
		@redis = get: (key, cb)->
				key.should.equal "user-learned-words:#{user_token}"
				cb(null, JSON.stringify(spellings))

		@cache = SandboxedModule.require modulePath, requires:
			'redis': createClient :=> return @redis

		@cache.get user_token, (err, returnedSpellings)->
			assert.deepEqual returnedSpellings, spellings
			assert.equal err, null
			done()

	it 'should return nothing if the key doesnt exist', (done)->
		@redis = get: (key, cb)->
				cb(null, null)
		@cache = SandboxedModule.require modulePath, requires:
			'redis': createClient :=> return @redis

		@cache.get user_token, (err, founduser)->
			assert.equal founduser, undefined
			done()

	it 'should be able to delete from redis to break cache', (done)->
		@redis = del: (key, cb)->
			key.should.equal "user-learned-words:#{user_token}"
			cb(null)
		@cache = SandboxedModule.require modulePath, requires:
			'redis': createClient :=> return @redis
		@cache.break user_token, done
