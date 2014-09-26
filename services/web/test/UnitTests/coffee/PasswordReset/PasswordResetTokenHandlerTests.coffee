should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/PasswordReset/PasswordResetTokenHandler"
expect = require("chai").expect

describe "PasswordResetTokenHandler", ->

	beforeEach ->
		@user_id = "user id here"
		@stubbedToken = require("crypto").randomBytes(32)

		@settings = 
			redis:
				web:{}
		@redisMulti =
			set:sinon.stub()
			get:sinon.stub()
			del:sinon.stub()
			expire:sinon.stub()
			exec:sinon.stub()
		self = @
		@PasswordResetTokenHandler = SandboxedModule.require modulePath, requires:
			"redis-sharelatex" :
				createClient: =>
					auth:->
					multi: -> return self.redisMulti

			"settings-sharelatex":@settings
			"logger-sharelatex": log:->
			"crypto": randomBytes: () => @stubbedToken


	describe "getNewToken", ->

		it "should set a new token into redis with a ttl", (done)->
			@redisMulti.exec.callsArgWith(0) 
			@PasswordResetTokenHandler.getNewToken @user_id, (err, token) =>
				@redisMulti.set.calledWith("password_token:#{@stubbedToken.toString("hex")}", @user_id).should.equal true
				@redisMulti.expire.calledWith("password_token:#{@stubbedToken.toString("hex")}", 60 * 60).should.equal true
				done()

		it "should return if there was an error", (done)->
			@redisMulti.exec.callsArgWith(0, "error")
			@PasswordResetTokenHandler.getNewToken @user_id, (err, token)=>
				err.should.exist
				done()


	describe "getUserIdFromTokenAndExpire", ->

		it "should get and delete the token", (done)->
			@redisMulti.exec.callsArgWith(0, null, [@user_id]) 
			@PasswordResetTokenHandler.getUserIdFromTokenAndExpire @stubbedToken, (err, user_id)=>
				user_id.should.equal @user_id
				@redisMulti.get.calledWith("password_token:#{@stubbedToken}").should.equal true
				@redisMulti.del.calledWith("password_token:#{@stubbedToken}").should.equal true
				done()



