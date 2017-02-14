assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/infrastructure/RedisWrapper.js"
SandboxedModule = require('sandboxed-module')

describe 'RedisWrapper', ->

	beforeEach ->
		@featureName = 'somefeature'
		@settings =
			redis:
				web:
					port:"1234"
					host:"somewhere"
					password: "password"
				somefeature: {}
		@normalRedisInstance =
			thisIsANormalRedisInstance: true
			n: 1
		@clusterRedisInstance =
			thisIsAClusterRedisInstance: true
			n: 2
		@redis =
			createClient: sinon.stub().returns(@normalRedisInstance)
		@ioredis =
			Cluster: sinon.stub().returns(@clusterRedisInstance)
		@logger = {log: sinon.stub()}

		@RedisWrapper = SandboxedModule.require modulePath, requires:
			'logger-sharelatex': @logger
			'settings-sharelatex': @settings
			'redis-sharelatex': @redis
			'ioredis': @ioredis

	describe 'client', ->

		beforeEach ->
			@call = () =>
				@RedisWrapper.client(@featureName)

		describe 'when feature uses cluster', ->

			beforeEach ->
				@settings.redis.somefeature =
					cluster: [1, 2, 3]

			it 'should return a cluster client', ->
				client = @call()
				expect(client).to.equal @clusterRedisInstance
				expect(client.__is_redis_cluster).to.equal true

		describe 'when feature uses normal redis', ->

			beforeEach ->
				@settings.redis.somefeature =
					port:"1234"
					host:"somewhere"
					password: "password"

			it 'should return a regular redis client', ->
				client = @call()
				expect(client).to.equal @normalRedisInstance
				expect(client.__is_redis_cluster).to.equal undefined
