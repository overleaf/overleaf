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
			"ioredis": @ioredis =
				Cluster: class Cluster
					constructor: (@config) ->
		@auth_pass = "1234 pass"
		@endpoints = [
				{host: '127.0.0.1', port: 26379},
				{host: '127.0.0.1', port: 26380}
			]

	describe "sentinel", ->
		beforeEach ->
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
			@sentinel.createClient.calledWith(@endpoints, @masterName, {auth_pass:@auth_pass, retry_max_delay: 5000}).should.equal true
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
			@normalRedis.createClient.calledWith(@standardOpts.port, @standardOpts.host, {auth_pass:@auth_pass, retry_max_delay: 5000}).should.equal true

	describe "cluster", ->
		beforeEach ->
			@cluster = [{"mock": "cluster"}, { "mock": "cluster2"}]

		it "should pass the options correctly though", ->
			client = @redis.createClient cluster: @cluster
			assert(client instanceof @ioredis.Cluster)
			client.config.should.deep.equal @cluster

	describe "monkey patch ioredis exec", ->
		beforeEach ->
			@callback = sinon.stub()
			@results = []
			@multiOrig = { exec: sinon.stub().yields(null, @results)}
			@client = { multi: sinon.stub().returns(@multiOrig) }
			@redis._monkeyPatchIoredisExec(@client)
			@multi = @client.multi()

		it "should return the old redis format for an array", ->
			@results[0] = [null, 42]
			@results[1] = [null, "foo"]
			@multi.exec @callback
			@callback.calledWith(null, [42, "foo"]).should.equal true

		it "should return the old redis format when there is an error", ->
			@results[0] = [null, 42]
			@results[1] = ["error", "foo"]
			@multi.exec @callback
			@callback.calledWith("error").should.equal true

	describe "setting the password", ->
		beforeEach ->
			@standardOpts =
				password: @auth_pass
				port: 1234
				host: "redis.mysite.env"

			@sentinelOptions =
				endpoints:@endpoints
				masterName:@masterName
				password: @auth_pass

		it "should set the auth_pass from password if password exists for normal redis", ->
			client = @redis.createClient @standardOpts
			@normalRedis.createClient.calledWith(@standardOpts.port, @standardOpts.host, {auth_pass:@auth_pass, retry_max_delay: 5000}).should.equal true
		
		it "should set the auth_pass from password if password exists for sentinal", ->
			client = @redis.createClient @sentinelOptions
			@sentinel.createClient.calledWith(@endpoints, @masterName, {auth_pass:@auth_pass, retry_max_delay: 5000}).should.equal true


