sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Rooms/RoomController.js"
SandboxedModule = require('sandboxed-module')
events = require "events"
ObjectId = require("mongojs").ObjectId

class MockClient
	params: {}
	get: (key, callback = (error, value) ->) ->
		callback null, @params[key]

describe "RoomController", ->
	beforeEach ->
		@SocketManager =
			getClientAttributes: sinon.stub()


		@RoomController = SandboxedModule.require modulePath, requires:
			"../Authorization/AuthorizationManager": @AuthorizationManager = {}
			"../Sockets/SocketManager": @SocketManager
			"../Rooms/RoomManager": @RoomManager = {}
			"logger-sharelatex": @logger = { log: sinon.stub() }


		@project_id = ObjectId().toString()
		@room_id = ObjectId().toString()
		@room =
			_id: ObjectId(@room_id)
			project_id: ObjectId(@project_id)
		@callback = sinon.stub()
		@client =
			params: {}
			get: (key, callback = (error, value) ->) -> callback null, @params[key]

	describe "joinRoom", ->
		describe "when the client is authorized", ->
			beforeEach ->
				@AuthorizationManager.canClientJoinProjectRoom = sinon.stub().callsArgWith(2, null, true)
				@RoomManager.findOrCreateRoom = sinon.stub().callsArgWith(1, null, @room)
				@RoomController._addClientToRoom = sinon.stub().callsArg(2)
				@RoomController._getClientsInRoom = sinon.stub().callsArgWith(1, null, @clients = ["client1", "client2"])
				@RoomController.joinRoom @client, { room: project_id: @project_id }, @callback

			it "should check that the client can join the room", ->
				@AuthorizationManager.canClientJoinProjectRoom
					.calledWith(@client, @project_id)
					.should.equal true

			it "should ensure that the room exists", ->
				@RoomManager.findOrCreateRoom
					.calledWith({ project_id: @project_id })
					.should.equal true

			it "should put the client into the room", ->
				@RoomController._addClientToRoom
					.calledWith(@client, @room_id)
					.should.equal true

			it "should get the clients already in the room", ->
				@RoomController._getClientsInRoom
					.calledWith(@room_id)
					.should.equal true

			it "should call the callback with the room id", ->
				@callback.calledWith(null, {
					room:
						id: @room_id
						connectedUsers: @clients
				}).should.equal true

		describe "when the client is not authorized", ->
			beforeEach ->
				@AuthorizationManager.canClientJoinProjectRoom = sinon.stub().callsArgWith(2, null, false)
				@RoomController._addClientToRoom = sinon.stub().callsArg(2)
				@RoomController.joinRoom @client, { room: project_id: @project_id }, @callback

			it "should not put the client into the room", ->
				@RoomController._addClientToRoom.called.should.equal false

			it "should call the callback with an error that gives nothing away", ->
				@callback.calledWith("unknown room").should.equal true

	describe "leaveAllRooms", ->

		beforeEach ->
			@client = new MockClient()
			@client.params =
				id: "client-1-id"
				first_name: "Douglas"
				last_name: "Adams"
				email: "doug@sharelatex.com"
				gravatar_url: "//gravatar/url/1"
			@room_ids = ["room-id-1", "room-id-2"]
			@SocketManager.getRoomIdsClientHasJoined = sinon.stub().callsArgWith(1, null, @room_ids)
			@RoomController.leaveRoom = sinon.stub().callsArg(2)
			@RoomController.leaveAllRooms @client, @callback

		it "should get the rooms the client has joined", ->
			@SocketManager.getRoomIdsClientHasJoined
				.calledWith(@client)
				.should.equal true

		it "should leave each room", ->
			for room_id in @room_ids
				@RoomController.leaveRoom
					.calledWith(@client, room_id)
					.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "leaveRoom", ->
		beforeEach ->
			@client = new MockClient()
			@client.params =
				id: "client-1-id"
				first_name: "Douglas"
				last_name: "Adams"
				email: "doug@sharelatex.com"
				gravatar_url: "//gravatar/url/1"
			@RoomController._getClientAttributes = sinon.stub().callsArgWith(1, null, @client.params)

			@SocketManager.removeClientFromRoom = sinon.stub().callsArg(2)
			@SocketManager.emitToRoom = sinon.stub()
			@RoomController.leaveRoom @client, @room_id, @callback

		it "should leave the room", ->
			@SocketManager.removeClientFromRoom
				.calledWith(@client, @room_id)
				.should.equal true

		it "should tell the other clients in the room that we have left", ->
			@SocketManager.emitToRoom
				.calledWith(@room_id, "userLeft", {
					room:
						id: @room_id
					user:
						id           : @client.params["id"]
						first_name   : @client.params["first_name"]
						last_name    : @client.params["last_name"]
						email        : @client.params["email"]
						gravatar_url : @client.params["gravatar_url"]
				})
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "_getClientsInRoom", ->
		beforeEach ->
			@client1 = new MockClient()
			@client1.params =
				id: "client-1-id"
				first_name: "Douglas"
				last_name: "Adams"
				email: "doug@sharelatex.com"
				gravatar_url: "//gravatar/url/1"
			@client2 = new MockClient()
			@client2.params =
				id: "client-2-id"
				first_name: "James"
				last_name: "Allen"
				email: "james@sharelatex.com"
				gravatar_url: "//gravatar/url/2"
			@clients = [ @client1, @client2 ]
			callCount = 0
			
			@RoomController._getClientAttributes = (ignore, cb)=>
				if callCount == 0
					callCount++
					cb(null, @client1.params)
				else
					cb null, @client2.params


			@SocketManager.getClientsInRoom = sinon.stub().callsArgWith(1, null, @clients)
			@RoomController._getClientsInRoom(@room_id, @callback)

		it "should get the socket.io clients in the room", ->
			@SocketManager.getClientsInRoom
				.calledWith(@room_id)
				.should.equal true

		it "should return a formatted array of clients", ->
			@callback
				.calledWith(null, [{
					id           : @client1.params["id"]
					first_name   : @client1.params["first_name"]
					last_name    : @client1.params["last_name"]
					email        : @client1.params["email"]
					gravatar_url : @client1.params["gravatar_url"]
				}, {
					id           : @client2.params["id"]
					first_name   : @client2.params["first_name"]
					last_name    : @client2.params["last_name"]
					email        : @client2.params["email"]
					gravatar_url : @client2.params["gravatar_url"]
				}])
				.should.equal true

	describe "_addClientToRoom", ->
		beforeEach ->
			@client = new MockClient()
			@client.params =
				id: "client-1-id"
				first_name: "Douglas"
				last_name: "Adams"
				email: "doug@sharelatex.com"
				gravatar_url: "//gravatar/url/1"
			@RoomController._getClientAttributes = sinon.stub().callsArgWith(1, null, @client.params)
			@SocketManager.addClientToRoom = sinon.stub().callsArg(2)
			@SocketManager.emitToRoom = sinon.stub()
			@RoomController._addClientToRoom(@client, @room_id, @callback)

		it "should add the client to the room", ->
			@SocketManager.addClientToRoom
				.calledWith(@client, @room_id)
				.should.equal true

		it "should tell the room that the client has been added", ->
			@SocketManager.emitToRoom
				.calledWith(@room_id, "userJoined", {
					room:
						id: @room_id
					user:
						id           : @client.params["id"]
						first_name   : @client.params["first_name"]
						last_name    : @client.params["last_name"]
						email        : @client.params["email"]
						gravatar_url : @client.params["gravatar_url"]
				})
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true


