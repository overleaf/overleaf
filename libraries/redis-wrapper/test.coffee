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
		@sentinelClient = 
			set: ->
			on: ->
		@normalRedisClient = 
			get: ->
			on: ->
		@ioredisConstructor = ioredisConstructor = sinon.stub()

		@sentinel =
			createClient: sinon.stub().returns(@sentinelClient)
		@normalRedis = 
			createClient: sinon.stub().returns(@normalRedisClient)
		@ioredis = class IoRedis
			constructor: ioredisConstructor
			on: sinon.stub()
		@ioredis.Cluster = class Cluster
			constructor: (@config, @options) ->
			on: sinon.stub()
		@redis = SandboxedModule.require modulePath, requires:
			"redis-sentinel":@sentinel
			"redis":@normalRedis
			"ioredis": @ioredis
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

	describe "single node redis", ->
		beforeEach ->
			@standardOpts =
				auth_pass: @auth_pass
				port: 1234
				host: "redis.mysite.env"

		it "should use the ioredis driver in single-instance mode if a non array is passed", ->
			client = @redis.createClient @standardOpts
			@sentinel.createClient.called.should.equal false
			@normalRedis.createClient.called.should.equal false
			assert.equal(client.constructor, @ioredis)

		it "should call createClient for the ioredis driver in single-instance mode if a non array is passed", ->
			client = @redis.createClient @standardOpts
			@ioredisConstructor.calledWith(@standardOpts).should.equal true

	describe "cluster", ->
		beforeEach ->
			@cluster = [{"mock": "cluster"}, { "mock": "cluster2"}]
			@extraOptions = {keepAlive:100}
			@settings =
				cluster: @cluster
				redisOptions: @extraOptions
				key_schema: {foo: (x) -> "#{x}"}

		it "should pass the options correctly though with no options", ->
			client = @redis.createClient cluster: @cluster
			assert(client instanceof @ioredis.Cluster)
			client.config.should.deep.equal @cluster

		it "should not pass the key_schema through to the driver", ->
			client = @redis.createClient cluster: @cluster, key_schema: "foobar"
			assert(client instanceof @ioredis.Cluster)
			client.config.should.deep.equal @cluster
			expect(client.options).to.deep.equal {retry_max_delay: 5000}

		it "should pass the options correctly though with additional options", ->
			client = @redis.createClient @settings
			assert(client instanceof @ioredis.Cluster)
			client.config.should.deep.equal @cluster
			# need to use expect here because of _.clone in sandbox
			expect(client.options).to.deep.equal {redisOptions: @extraOptions, retry_max_delay: 5000}

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

