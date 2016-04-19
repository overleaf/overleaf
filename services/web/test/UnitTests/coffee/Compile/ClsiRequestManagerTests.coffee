sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Compile/ClsiRequestManager.js"
SandboxedModule = require('sandboxed-module')
realRequst = require("request")
describe "ClsiRequestManager", ->
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
		@ClsiRequestManager = SandboxedModule.require modulePath, requires:
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
			@ClsiRequestManager._getServerId @project_id, (err, serverId)=>
				@redisMulti.get.calledWith("clsiserver:#{@project_id}").should.equal true
				serverId.should.equal "clsi-7"
				done()

		it "should expire the key", (done)->
			@redisMulti.exec.callsArgWith(0, null, ["clsi-7"])
			@ClsiRequestManager._getServerId @project_id, (err, serverId)=>
				@redisMulti.expire.calledWith("clsiserver:#{@project_id}", 60 * 60 * 24 * 7).should.equal true
				done()

		it "should _getServerIdViaRequest if no key is found", (done)->
			@ClsiRequestManager._getServerIdViaRequest = sinon.stub().callsArgWith(1)
			@redisMulti.exec.callsArgWith(0, null, [])
			@ClsiRequestManager._getServerId @project_id, (err, serverId)=>
				@ClsiRequestManager._getServerIdViaRequest.calledWith(@project_id).should.equal true
				done()


	describe "_getServerIdViaRequest", ->

		it "should make a request to the clsi", (done)->
			response  = "some data"
			@request.get.callsArgWith(1, null, response)
			@ClsiRequestManager.setServerId = sinon.stub().callsArgWith(2)
			@ClsiRequestManager._getServerIdViaRequest @project_id, (err, serverId)=>
				args = @ClsiRequestManager.setServerId.args[0]
				args[0].should.equal @project_id
				args[1].should.deep.equal response
				done()

	describe "setServerId", ->

		it "should set the server id with a ttl", (done)->
			@ClsiRequestManager._parseServerIdFromResponse = sinon.stub().returns("clsi-8")
			response = "dsadsakj"
			@redisMulti.exec.callsArgWith(0)
			@ClsiRequestManager.setServerId @project_id, response, (err)=>
				@redisMulti.set.calledWith("clsiserver:#{@project_id}", "clsi-8").should.equal true
				@redisMulti.expire.calledWith("clsiserver:#{@project_id}", 60 * 60 * 24 * 7).should.equal true
				done()


	describe "getCookieJar", ->

		it "should return a jar with the cookie set populated from redis", (done)->
			@ClsiRequestManager._getServerId = sinon.stub().callsArgWith(1, null, "clsi-11")
			opts = {}
			@ClsiRequestManager.getCookieJar @project_id, opts, (err, jar)->
				jar._jar.store.idx["clsi.example.com"]["/"].clsiserver.key.should.equal "clsiserver"
				jar._jar.store.idx["clsi.example.com"]["/"].clsiserver.value.should.equal "clsi-11"
				done()


	# describe "_parseServerIdFromResponse", ->
	# 	it "take the cookie from the response", (done)->

	# 		a.should.equal 












