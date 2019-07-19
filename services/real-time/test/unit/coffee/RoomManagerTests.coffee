chai = require('chai')
should = chai.should()
sinon = require("sinon")
modulePath = "../../../app/js/RoomManager.js"
SandboxedModule = require('sandboxed-module')

describe 'RoomManager', ->
	beforeEach ->
		@project_id = "project-id-123"
		@user_id = "user-id-123"
		@user = {_id: @user_id}
		@callback = sinon.stub()
		@RoomManager = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @settings = {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
	
	describe "joinProject", ->
	
		describe "when the project room is empty", ->

		describe "when there are other clients in the project room", ->

	describe "joinDoc", ->

		describe "when the doc room is empty", ->

		describe "when there are other clients in the doc room", ->

	describe "leaveDoc", ->

		describe "when doc room will be empty after this client has left", ->

		describe "when there are other clients in the doc room", ->

	describe "leaveProjectAndDocs", ->

		describe "when the client is connected to multiple docs", ->