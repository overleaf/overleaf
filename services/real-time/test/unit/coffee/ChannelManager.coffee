chai = require('chai')
should = chai.should()
sinon = require("sinon")
modulePath = "../../../app/js/ChannelManager.js"
SandboxedModule = require('sandboxed-module')

describe 'ChannelManager', ->
	beforeEach ->
		@project_id = "project-id-123"
		@user_id = "user-id-123"
		@user = {_id: @user_id}
		@callback = sinon.stub()
		@ChannelManager = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @settings = {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
	
	describe "subscribe", ->
	
		describe "when the project room is empty", ->

		describe "when there are other clients in the project room", ->

	describe "unsubscribe", ->

		describe "when the doc room is empty", ->

		describe "when there are other clients in the doc room", ->

	describe "publish", ->

		describe "when the channel is 'all'", ->

		describe "when the channel has an specific id", ->
