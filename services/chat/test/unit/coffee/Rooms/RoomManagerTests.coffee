sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Rooms/RoomManager.js"
SandboxedModule = require('sandboxed-module')
events = require "events"
mongojs = require "mongojs"
ObjectId = mongojs.ObjectId

describe "RoomManager", ->
	beforeEach ->
		@RoomManager = SandboxedModule.require modulePath, requires:
			"../../mongojs":
				db: @db = { rooms: {} }
				ObjectId: ObjectId
		@callback = sinon.stub()

	describe "findOrCreateRoom", ->
		describe "when the room exists", ->
			beforeEach ->
				@project_id = ObjectId().toString()
				@room =
					_id: ObjectId()
					project_id: ObjectId(@project_id)
				@db.rooms.findOne = sinon.stub().callsArgWith(1, null, @room)
				@RoomManager.findOrCreateRoom(project_id: @project_id, @callback)

			it "should look up the room based on the query", ->
				@db.rooms.findOne
					.calledWith(project_id: ObjectId(@project_id))
					.should.equal true

			it "should return the room in the callback", ->
				@callback
					.calledWith(null, @room)
					.should.equal true

		describe "when the room does not exist", ->
			beforeEach ->
				@project_id = ObjectId().toString()
				@room =
					_id: ObjectId()
					project_id: ObjectId(@project_id)
				@db.rooms.findOne = sinon.stub().callsArgWith(1, null, null)
				@db.rooms.save = sinon.stub().callsArgWith(1, null, @room)
				@RoomManager.findOrCreateRoom(project_id: @project_id, @callback)
				
			it "should create the room", ->
				@db.rooms.save
					.calledWith(project_id: ObjectId(@project_id))
					.should.equal true

			it "should return the room in the callback", ->
				@callback
					.calledWith(null, @room)
					.should.equal true

