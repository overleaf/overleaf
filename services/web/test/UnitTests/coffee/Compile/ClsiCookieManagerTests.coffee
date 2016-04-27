sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Compile/ClsiCookieManager.js"
SandboxedModule = require('sandboxed-module')
realRequst = require("request")

describe "ClsiCookieManager", ->
	beforeEach ->
		@redisMulti =
			set:sinon.stub()
			get:sinon.stub()
			expire:sinon.stub()
			exec:sinon.stub()
		self = @
		@project_id = "123423431321"
		@request =
			get: sinon.stub()
			cookie:realRequst.cookie
			jar: realRequst.jar
		@ClsiCookieManager = SandboxedModule.require modulePath, requires:
			"redis-sharelatex" :
				createClient: =>
					auth:->
					multi: -> return self.redisMulti
			"settings-sharelatex": @settings =
				redis:
					web:"redis.something"
				apis:
					clsi:
						url: "http://clsi.example.com"
			"request": @request

			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub(), warn: sinon.stub() }



	describe "getServerId", ->

		it "should call get for the key", (done)->
			@redisMulti.exec.callsArgWith(0, null, ["clsi-7"])
			@ClsiCookieManager._getServerId @project_id, (err, serverId)=>
				@redisMulti.get.calledWith("clsiserver:#{@project_id}").should.equal true
				serverId.should.equal "clsi-7"
				done()

		it "should _populateServerIdViaRequest if no key is found", (done)->
			@ClsiCookieManager._populateServerIdViaRequest = sinon.stub().callsArgWith(1)
			@redisMulti.exec.callsArgWith(0, null, [])
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
				@redisMulti.expire.calledWith("clsiserver:#{@project_id}", 60 * 60 * 24 * 7).should.equal true
				done()

		it "should return the server id", (done)->
			@ClsiCookieManager.setServerId @project_id, @response, (err, serverId)=>
				serverId.should.equal "clsi-8"
				done()

	describe "getCookieJar", ->

		it "should return a jar with the cookie set populated from redis", (done)->
			@ClsiCookieManager._getServerId = sinon.stub().callsArgWith(1, null, "clsi-11")
			opts = {}
			@ClsiCookieManager.getCookieJar @project_id, (err, jar)->
				jar._jar.store.idx["clsi.example.com"]["/"].clsiserver.key.should.equal "clsiserver"
				jar._jar.store.idx["clsi.example.com"]["/"].clsiserver.value.should.equal "clsi-11"
				done()









