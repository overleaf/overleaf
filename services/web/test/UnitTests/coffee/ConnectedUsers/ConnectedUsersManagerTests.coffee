
should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/ConnectedUsers/ConnectedUsersManager"
expect = require("chai").expect
tk = require("timekeeper")


describe "ConnectedUsersManager", ->

	beforeEach ->

		@settings =
			redis:
				web:{}
		@rClient =
			auth:->
			setex:sinon.stub()
			sadd:sinon.stub()
			get: sinon.stub()
			srem:sinon.stub()
			del:sinon.stub()
			smembers:sinon.stub()
			expire:sinon.stub()
			hset:sinon.stub()
			hgetall:sinon.stub()
			exec:sinon.stub()
			multi: => return @rClient
		tk.freeze(new Date())

		@ConnectedUsersManager = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": log:->
			"redis": createClient:=> 
				return @rClient
		@client_id = "32132132"
		@project_id = "dskjh2u21321"
		@user = {
			_id: "user-id-123"
			first_name: "Joe"
			last_name: "Bloggs"
			email: "joe@example.com"
		}

	afterEach -> 
		tk.reset()

	describe "markUserAsConnected", ->
		beforeEach ->
			@rClient.exec.callsArgWith(0)

		it "should set a key with the date and give it a ttl", (done)->
			@ConnectedUsersManager.markUserAsConnected @project_id, @client_id, @user, (err)=>
				@rClient.hset.calledWith("connected_user:#{@project_id}:#{@client_id}", "connected_at", Date.now()).should.equal true
				done()

		it "should set a key with the user_id", (done)->
			@ConnectedUsersManager.markUserAsConnected @project_id, @client_id, @user, (err)=>
				@rClient.hset.calledWith("connected_user:#{@project_id}:#{@client_id}", "user_id", @user._id).should.equal true
				done()

		it "should set a key with the first_name", (done)->
			@ConnectedUsersManager.markUserAsConnected @project_id, @client_id, @user, (err)=>
				@rClient.hset.calledWith("connected_user:#{@project_id}:#{@client_id}", "first_name", @user.first_name).should.equal true
				done()

		it "should set a key with the last_name", (done)->
			@ConnectedUsersManager.markUserAsConnected @project_id, @client_id, @user, (err)=>
				@rClient.hset.calledWith("connected_user:#{@project_id}:#{@client_id}", "last_name", @user.last_name).should.equal true
				done()

		it "should set a key with the email", (done)->
			@ConnectedUsersManager.markUserAsConnected @project_id, @client_id, @user, (err)=>
				@rClient.hset.calledWith("connected_user:#{@project_id}:#{@client_id}", "email", @user.email).should.equal true
				done()

		it "should push the client_id on to the project list", (done)->
			@ConnectedUsersManager.markUserAsConnected @project_id, @client_id, @user, (err)=>
				@rClient.sadd.calledWith("clients_in_project:#{@project_id}", @client_id).should.equal true
				done()

		it "should add a ttl to the connected user set so it stays clean", (done)->
			@ConnectedUsersManager.markUserAsConnected @project_id, @client_id, @user, (err)=>
				@rClient.expire.calledWith("clients_in_project:#{@project_id}", 24 * 4 * 60 * 60).should.equal true
				done()

		it "should add a ttl to the connected user so it stays clean", (done)->
			@ConnectedUsersManager.markUserAsConnected @project_id, @client_id, @user, (err)=>
				@rClient.expire.calledWith("connected_user:#{@project_id}:#{@client_id}", 60 * 60).should.equal true
				done()

	describe "markUserAsDisconnected", ->
		beforeEach ->
			@rClient.exec.callsArgWith(0)

		it "should remove the user from the set", (done)->
			@ConnectedUsersManager.markUserAsDisconnected @project_id, @client_id, (err)=>
				@rClient.srem.calledWith("clients_in_project:#{@project_id}", @client_id).should.equal true
				done()

		it "should delete the connected_user string", (done)->
			@ConnectedUsersManager.markUserAsDisconnected @project_id, @client_id, (err)=>
				@rClient.del.calledWith("connected_user:#{@project_id}:#{@client_id}").should.equal true
				done()

		it "should add a ttl to the connected user set so it stays clean", (done)->
			@ConnectedUsersManager.markUserAsDisconnected @project_id, @client_id, (err)=>
				@rClient.expire.calledWith("clients_in_project:#{@project_id}", 24 * 4 * 60 * 60).should.equal true
				done()

	describe "_getConnectedUser", ->

		it "should get the user returning connected if there is a value", (done)->
			cursorData = JSON.stringify(cursorData:{row:1})
			@rClient.hgetall.callsArgWith(1, null, {connected_at:new Date(), cursorData})
			@ConnectedUsersManager._getConnectedUser @project_id, @client_id, (err, result)=>
				result.connected.should.equal true
				result.client_id.should.equal @client_id
				done()

		it "should get the user returning connected if there is a value", (done)->
			@rClient.hgetall.callsArgWith(1)
			@ConnectedUsersManager._getConnectedUser @project_id, @client_id, (err, result)=>
				result.connected.should.equal false
				result.client_id.should.equal @client_id
				done()

	describe "getConnectedUsers", ->

		beforeEach ->
			@users = ["1234", "5678", "9123"]
			@rClient.smembers.callsArgWith(1, null, @users)
			@ConnectedUsersManager._getConnectedUser = sinon.stub()
			@ConnectedUsersManager._getConnectedUser.withArgs(@project_id, @users[0]).callsArgWith(2, null, {connected:true, client_id:@users[0]})
			@ConnectedUsersManager._getConnectedUser.withArgs(@project_id, @users[1]).callsArgWith(2, null, {connected:false, client_id:@users[1]})
			@ConnectedUsersManager._getConnectedUser.withArgs(@project_id, @users[2]).callsArgWith(2, null, {connected:true, client_id:@users[2]})


		it "should only return the users in the list which are still in redis", (done)->
			@ConnectedUsersManager.getConnectedUsers @project_id, (err, users)=>
				users.length.should.equal 2
				users[0].should.deep.equal {client_id:@users[0], connected:true}
				users[1].should.deep.equal {client_id:@users[2], connected:true}
				done()

	describe "setUserCursorPosition", ->

		beforeEach ->
			@cursorData = { row: 12, column: 9, doc_id: '53c3b8c85fee64000023dc6e' }
			@rClient.exec.callsArgWith(0)

		it "should add the cursor data to the users hash", (done)->
			@ConnectedUsersManager.setUserCursorPosition @project_id, @client_id, @cursorData, (err)=>
				@rClient.hset.calledWith("connected_user:#{@project_id}:#{@client_id}", "cursorData", JSON.stringify(@cursorData)).should.equal true
				done()


		it "should add the ttl on", (done)->
			@ConnectedUsersManager.setUserCursorPosition @project_id, @client_id, @cursorData, (err)=>
				@rClient.expire.calledWith("connected_user:#{@project_id}:#{@client_id}", 60 * 60).should.equal true
				done()

