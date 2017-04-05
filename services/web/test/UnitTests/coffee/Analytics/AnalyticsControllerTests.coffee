should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
modulePath = path.join __dirname, '../../../../app/js/Features/Analytics/AnalyticsController'
sinon = require("sinon")
expect = require("chai").expect


describe 'AnalyticsController', ->

	beforeEach ->
		@AuthenticationController =
			getLoggedInUserId: sinon.stub()

		@AnalyticsManager =
			recordEvent: sinon.stub().callsArgWith(3)

		@req = 
			params:
				event:"i_did_something"
			body:"stuff"
			sessionID: "sessionIDHere"

		@res =
			send:->
		@controller = SandboxedModule.require modulePath, requires:
			"./AnalyticsManager":@AnalyticsManager
			"../Authentication/AuthenticationController":@AuthenticationController
			"logger-sharelatex":
				log:->

	describe "recordEvent", ->

		it "should use the user_id", (done)->
			@AuthenticationController.getLoggedInUserId.returns("1234")
			@controller.recordEvent @req, @res
			@AnalyticsManager.recordEvent.calledWith("1234", @req.params["event"], @req.body).should.equal true
			done()

		it "should use the session id", (done)->
			@controller.recordEvent @req, @res
			@AnalyticsManager.recordEvent.calledWith(@req.sessionID, @req.params["event"], @req.body).should.equal true
			done()
