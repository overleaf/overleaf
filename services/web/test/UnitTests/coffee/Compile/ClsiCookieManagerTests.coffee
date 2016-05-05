sinon = require('sinon')
chai = require('chai')
assert = chai.assert
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Compile/ClsiCookieManager.js"
SandboxedModule = require('sandboxed-module')
realRequst = require("request")

describe "ClsiCookieManager", ->
	beforeEach ->
		self = @
		@redisMulti =
			set:sinon.stub()
			get:sinon.stub()
			expire:sinon.stub()
			exec:sinon.stub()
		@redis =
			auth:->
			get:sinon.stub()
			multi: -> return self.redisMulti
		@project_id = "123423431321"
		@request =
			get: sinon.stub()
			cookie:realRequst.cookie
			jar: realRequst.jar
		@settings =
			redis:
				web:"redis.something"
			apis:
				clsi:
					url: "http://clsi.example.com"
			clsi_cookie_expire_length: Math.random()
			clsiCookieKey: "coooookie"
		@requires = 
			"redis-sharelatex" :
				createClient: =>
					@redis
			"settings-sharelatex": @settings
			"request": @request

			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub(), warn: sinon.stub() }
		@ClsiCookieManager = SandboxedModule.require modulePath, requires:@requires



	describe "getServerId", ->

		it "should call get for the key", (done)->
			@redis.get.callsArgWith(1, null, "clsi-7")
			@ClsiCookieManager._getServerId @project_id, (err, serverId)=>
				@redis.get.calledWith("clsiserver:#{@project_id}").should.equal true
				serverId.should.equal "clsi-7"
				done()

		it "should _populateServerIdViaRequest if no key is found", (done)->
			@ClsiCookieManager._populateServerIdViaRequest = sinon.stub().callsArgWith(1)
			@redis.get.callsArgWith(1, null)
			@ClsiCookieManager._getServerId @project_id, (err, serverId)=>
				@ClsiCookieManager._populateServerIdViaRequest.calledWith(@project_id).should.equal true
				done()


	describe "_populateServerIdViaRequest", ->

		beforeEach ->
			@response  = "some data"
			@request.get.callsArgWith(1, null, @response)
			@ClsiCookieManager.setServerId = sinon.stub().callsArgWith(2, null, "clsi-9")

		it "should make a request to the clsi", (done)->
			@ClsiCookieManager._populateServerIdViaRequest @project_id, (err, serverId)=>
				args = @ClsiCookieManager.setServerId.args[0]
				args[0].should.equal @project_id
				args[1].should.deep.equal @response
				done()

		it "should return the server id", (done)->
			@ClsiCookieManager._populateServerIdViaRequest @project_id, (err, serverId)=>
				serverId.should.equal "clsi-9"
				done()

	describe "setServerId", ->

		beforeEach ->
			@response = "dsadsakj"
			@ClsiCookieManager._parseServerIdFromResponse = sinon.stub().returns("clsi-8")
			@redisMulti.exec.callsArgWith(0)

		it "should set the server id with a ttl", (done)->
			@ClsiCookieManager.setServerId @project_id, @response, (err)=>
				@redisMulti.set.calledWith("clsiserver:#{@project_id}", "clsi-8").should.equal true
				@redisMulti.expire.calledWith("clsiserver:#{@project_id}", @settings.clsi_cookie_expire_length).should.equal true
				done()

		it "should return the server id", (done)->
			@ClsiCookieManager.setServerId @project_id, @response, (err, serverId)=>
				serverId.should.equal "clsi-8"
				done()


		it "should not set the server id if clsiCookies are not enabled", (done)->
			delete @settings.clsiCookieKey 
			@ClsiCookieManager = SandboxedModule.require modulePath, requires:@requires
			@ClsiCookieManager.setServerId @project_id, @response, (err, serverId)=>
				@redisMulti.exec.called.should.equal false
				done()

	describe "getCookieJar", ->

		beforeEach ->
			@ClsiCookieManager._getServerId = sinon.stub().callsArgWith(1, null, "clsi-11")

		it "should return a jar with the cookie set populated from redis", (done)->
			@ClsiCookieManager.getCookieJar @project_id, (err, jar)->
				jar._jar.store.idx["clsi.example.com"]["/"].clsiserver.key.should.equal "clsiserver"
				jar._jar.store.idx["clsi.example.com"]["/"].clsiserver.value.should.equal "clsi-11"
				done()


		it "should return empty cookie jar if clsiCookies are not enabled", (done)->
			delete @settings.clsiCookieKey 
			@ClsiCookieManager = SandboxedModule.require modulePath, requires:@requires
			@ClsiCookieManager.getCookieJar @project_id, (err, jar)->
				assert.deepEqual jar, realRequst.jar()
				done()







