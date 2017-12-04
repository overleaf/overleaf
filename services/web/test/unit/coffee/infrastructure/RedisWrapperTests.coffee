assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/infrastructure/RedisWrapper.js"
SandboxedModule = require('sandboxed-module')

describe 'RedisWrapper', ->

	beforeEach ->
		@settings = { redis: {} }
		@redis =
			createClient: sinon.stub()
		@RedisWrapper = SandboxedModule.require modulePath, requires:
			'settings-sharelatex': @settings
			'redis-sharelatex': @redis

	describe 'client', ->
		it "should use the feature settings if present", ->
			@settings.redis =
				my_feature:
					port:"23456"
					host:"otherhost"
					password: "banana"
			@RedisWrapper.client("my_feature")
			@redis.createClient.calledWith(@settings.redis.my_feature).should.equal true

		it "should use the web settings if feature not present", ->
			@settings.redis =
				web:
					port:"43"
					host:"otherhost"
					password: "banana"
			@RedisWrapper.client("my_feature")
			@redis.createClient.calledWith(@settings.redis.web).should.equal true
