chai = require('chai')
should = chai.should()
sinon = require("sinon")
modulePath = "../../../app/js/RoomManager.js"
SandboxedModule = require('sandboxed-module')

describe 'RoomManager', ->
	beforeEach ->
		@project_id = "project-id-123"
		@doc_id = "doc-id-456"
		@other_doc_id = "doc-id-789"
		@client = {namespace: {name: ''}, id: "first-client"}
		@RoomManager = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @settings = {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
		@RoomManager._clientsInRoom = sinon.stub()
		@RoomEvents = @RoomManager.eventSource()
		sinon.spy(@RoomEvents, 'emit') 
	
	describe "joinProject", ->
	
		describe "when the project room is empty", ->

			beforeEach ->
				@RoomManager._clientsInRoom
					.withArgs(@client, @project_id)
					.onFirstCall().returns(0)
					.onSecondCall().returns(1)
				@client.join = sinon.stub()
				@RoomManager.joinProject @client, @project_id

			it "should join the room using the id", ->
				@client.join.calledWithExactly(@project_id).should.equal true

			it "should emit a 'project-active' event with the id", ->
				@RoomEvents.emit.calledWithExactly('project-active', @project_id).should.equal true

		describe "when there are other clients in the project room", ->

			beforeEach ->
				@RoomManager._clientsInRoom
					.withArgs(@client, @project_id)
					.onFirstCall().returns(123)
					.onSecondCall().returns(124)
				@client.join = sinon.stub()
				@RoomManager.joinProject @client, @project_id

			it "should join the room using the id", ->
				@client.join.called.should.equal true

			it "should not emit any events", ->
				@RoomEvents.emit.called.should.equal false


	describe "joinDoc", ->

		describe "when the doc room is empty", ->

			beforeEach ->
				@RoomManager._clientsInRoom
					.withArgs(@client, @doc_id)
					.onFirstCall().returns(0)
					.onSecondCall().returns(1)
				@client.join = sinon.stub()
				@RoomManager.joinDoc @client, @doc_id

			it "should join the room using the id", ->
				@client.join.calledWithExactly(@doc_id).should.equal true

			it "should emit a 'doc-active' event with the id", ->
				@RoomEvents.emit.calledWithExactly('doc-active', @doc_id).should.equal true

		describe "when there are other clients in the doc room", ->

			beforeEach ->
				@RoomManager._clientsInRoom
					.withArgs(@client, @doc_id)
					.onFirstCall().returns(123)
					.onSecondCall().returns(124)
				@client.join = sinon.stub()
				@RoomManager.joinDoc @client, @doc_id

			it "should join the room using the id", ->
				@client.join.called.should.equal true

			it "should not emit any events", ->
				@RoomEvents.emit.called.should.equal false


	describe "leaveDoc", ->

		describe "when doc room will be empty after this client has left", ->

			beforeEach ->
				@RoomManager._clientsInRoom
					.withArgs(@client, @doc_id)
					.onFirstCall().returns(1)
					.onSecondCall().returns(0)
				@client.leave = sinon.stub()
				@RoomManager.leaveDoc @client, @doc_id

			it "should leave the room using the id", ->
				@client.leave.calledWithExactly(@doc_id).should.equal true

			it "should emit a 'doc-empty' event with the id", ->
				@RoomEvents.emit.calledWithExactly('doc-empty', @doc_id).should.equal true


		describe "when there are other clients in the doc room", ->

			beforeEach ->
				@RoomManager._clientsInRoom
					.withArgs(@client, @doc_id)
					.onFirstCall().returns(123)
					.onSecondCall().returns(122)
				@client.leave = sinon.stub()
				@RoomManager.leaveDoc @client, @doc_id

			it "should leave the room using the id", ->
				@client.leave.calledWithExactly(@doc_id).should.equal true

			it "should not emit any events", ->
				@RoomEvents.emit.called.should.equal false


	describe "leaveProjectAndDocs", ->

		describe "when the client is connected to the project and multiple docs", ->

			beforeEach ->
				@RoomManager._roomsClientIsIn = sinon.stub().returns [@project_id, @doc_id, @other_doc_id]
				@client.join = sinon.stub()
				@client.leave = sinon.stub()

			describe "when this is the only client connected", ->

				beforeEach ->
						# first and secondc calls are for the join, 
					# calls 2 and 3 are for the leave
					@RoomManager._clientsInRoom
						.withArgs(@client, @doc_id)
						.onCall(0).returns(0)
						.onSecondCall().returns(1)
						.onCall(2).returns(1)
						.onCall(3).returns(0)
					@RoomManager._clientsInRoom
						.withArgs(@client, @other_doc_id)
						.onCall(0).returns(0)
						.onCall(1).returns(1)
						.onCall(2).returns(1)
						.onCall(3).returns(0)
					@RoomManager._clientsInRoom
						.withArgs(@client, @project_id)
						.onCall(0).returns(0)
						.onCall(1).returns(1)
						.onCall(2).returns(1)
						.onCall(3).returns(0)
					# put the client in the rooms
					@RoomManager.joinProject(@client, @project_id)
					@RoomManager.joinDoc(@client, @doc_id)
					@RoomManager.joinDoc(@client, @other_doc_id)
					# now leave the project
					@RoomManager.leaveProjectAndDocs @client

				it "should leave all the docs", ->
					@client.leave.calledWithExactly(@doc_id).should.equal true
					@client.leave.calledWithExactly(@other_doc_id).should.equal true

				it "should leave the project", ->
					@client.leave.calledWithExactly(@project_id).should.equal true

				it "should emit a 'doc-empty' event with the id for each doc", ->
					@RoomEvents.emit.calledWithExactly('doc-empty', @doc_id).should.equal true
					@RoomEvents.emit.calledWithExactly('doc-empty', @other_doc_id).should.equal true

				it "should emit a 'project-empty' event with the id for the project", ->
					@RoomEvents.emit.calledWithExactly('project-empty', @project_id).should.equal true

			describe "when other clients are still connected", ->

				beforeEach ->
					@RoomManager._clientsInRoom
						.withArgs(@client, @doc_id)
						.onFirstCall().returns(123)
						.onSecondCall().returns(122)
					@RoomManager._clientsInRoom
						.withArgs(@client, @other_doc_id)
						.onFirstCall().returns(123)
						.onSecondCall().returns(122)
					@RoomManager._clientsInRoom
						.withArgs(@client, @project_id)
						.onFirstCall().returns(123)
						.onSecondCall().returns(122)
					@RoomManager.leaveProjectAndDocs @client

				it "should leave all the docs", ->
					@client.leave.calledWithExactly(@doc_id).should.equal true
					@client.leave.calledWithExactly(@other_doc_id).should.equal true

				it "should leave the project", ->
					@client.leave.calledWithExactly(@project_id).should.equal true

				it "should not emit any events", ->
					@RoomEvents.emit.called.should.equal false