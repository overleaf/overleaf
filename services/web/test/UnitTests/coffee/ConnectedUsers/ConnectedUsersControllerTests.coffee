should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/ConnectedUsers/ConnectedUsersController"
expect = require("chai").expect

describe "ConnectedUsersController", ->

	beforeEach ->

		@settings = {}
		@ConnectedUsersManager =
			getConnectedUsers:sinon.stub()
		@ConnectedUsersController = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"./ConnectedUsersManager":@ConnectedUsersManager
			"logger-sharelatex": 
				log:->
				err:->
		@project_id = "231312390128309"
		@req = 
			params:
				project_id:@project_id
		@res = {}


	describe "getConnectedUsers", ->

		beforeEach ->
			@connectedUsersData = [{user_id:"312321"}, {user_id:"3213213"}]

		it "should get the connected user data for that project", (done)->
			@ConnectedUsersManager.getConnectedUsers.callsArgWith(1, null, @connectedUsersData)
			@res.send = (d)=>
				d.should.deep.equal @connectedUsersData
				done()
			@ConnectedUsersController.getConnectedUsers @req, @res

		it "should send a 500 on an error", (done)->
			@ConnectedUsersManager.getConnectedUsers.callsArgWith(1, "error")
			@res.send = (code)=>
				code.should.equal 500
				done()
			@ConnectedUsersController.getConnectedUsers @req, @res
