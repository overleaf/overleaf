should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "./index.coffee"
expect = require("chai").expect

describe "index", ->

	beforeEach ->

		@settings = {}
		@sentinelClient = set:->
		@normalRedisClient = get: ->

		@sentinel =
			createClient: sinon.stub().returns(@sentinelClient)
		@normalRedis = 
			createClient: sinon.stub().returns(@normalRedisClient)
		@redis = SandboxedModule.require modulePath, requires:
			"redis-sentinel":@sentinel
			"redis":@normalRedis
		@auth_pass = "1234 pass"

	describe "sentinel", ->

		beforeEach ->
			@endpoints = [
				{host: '127.0.0.1', port: 26379},
				{host: '127.0.0.1', port: 26380}
			]
			@masterName = "my master"
			@sentinelOptions =
				endpoints:@endpoints
				masterName:@masterName
				auth_pass:@auth_pass

		it "should use sentinal if the first argument in an array", ->
			client = @redis.createClient @sentinelOptions
			@sentinel.createClient.called.should.equal true
			@normalRedis.createClient.called.should.equal false
			client.should.equal @sentinelClient

		it "should pass the options correctly though", ->
			client = @redis.createClient @sentinelOptions
			@sentinel.createClient.calledWith(@endpoints, @masterName, auth_pass:@auth_pass).should.equal true
			client.should.equal @sentinelClient

	describe "normal redis", ->

		beforeEach ->
			@standardOpts =
				auth_pass: @auth_pass
				port: 1234
				host: "redis.mysite.env"

		it "should use the normal redis driver if a non array is passed", ->
			client = @redis.createClient @standardOpts
			@sentinel.createClient.called.should.equal false
			@normalRedis.createClient.called.should.equal true
			client.should.equal @normalRedisClient

		it "should use the normal redis driver if a non array is passed", ->
			client = @redis.createClient @standardOpts
			@normalRedis.createClient.calledWith(@standardOpts.port, @standardOpts.host, auth_pass:@auth_pass).should.equal true





