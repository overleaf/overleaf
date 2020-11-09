should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "./../../../index.js"
expect = require("chai").expect

describe "index", ->

	beforeEach ->

		@settings = {}
		@ioredisConstructor = ioredisConstructor = sinon.stub()

		@ioredis = class IoRedis
			constructor: ioredisConstructor
			on: sinon.stub()
		@ioredis.Cluster = class Cluster
			constructor: (@config, @options) ->
			on: sinon.stub()
		@redis = SandboxedModule.require modulePath, requires:
			"ioredis": @ioredis
		@auth_pass = "1234 pass"

	describe "single node redis", ->
		beforeEach ->
			@standardOpts =
				auth_pass: @auth_pass
				port: 1234
				host: "redis.mysite.env"

		it "should use the ioredis driver in single-instance mode if a non array is passed", ->
			client = @redis.createClient @standardOpts
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

