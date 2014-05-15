should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/PasswordReset/TokenGenerator"
expect = require("chai").expect

describe "TokenGenerator", ->

	beforeEach ->
		@user_id = "user id here"
		@stubbedToken = "dsajdiojlklksda"

		@settings = 
			redis:
				web:{}
		@redisMulti =
			set:sinon.stub()
			get:sinon.stub()
			del:sinon.stub()
			expire:sinon.stub()
			exec:sinon.stub()
		@uuid = v4 : -> return @stubbedToken
		self = @
		@TokenGenerator = SandboxedModule.require modulePath, requires:
			"redis" :
				createClient: =>
					auth:->
					multi: -> return self.redisMulti

			"settings-sharelatex":@settings
			"logger-sharelatex": log:->
			"node-uuid":@uuid


	describe "getNewToken", ->

		it "should set a new token into redis with a ttl", (done)->
			@redisMulti.exec.callsArgWith(0) 
			@TokenGenerator.getNewToken @user_id, (err, token)=>
				@redisMulti.set "password_token:#{@stubbedToken}", @user_id
				@redisMulti.expire "password_token:#{@stubbedToken}", 60 * 60
				done()

		it "should return if there was an error", (done)->
			@redisMulti.exec.callsArgWith(0, "error")
			@TokenGenerator.getNewToken @user_id, (err, token)=>
				err.should.exist
				done()


	describe "getUserIdFromToken", ->

		it "should get and delete the token", (done)->
			@redisMulti.exec.callsArgWith(0, null, [@user_id]) 
			@TokenGenerator.getUserIdFromToken @stubbedToken, (err, user_id)=>
				user_id.should.equal @user_id
				@redisMulti.get.calledWith("password_token:#{@stubbedToken}").should.equal true
				@redisMulti.del.calledWith("password_token:#{@stubbedToken}").should.equal true
				done()



