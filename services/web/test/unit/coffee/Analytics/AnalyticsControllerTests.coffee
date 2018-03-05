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
			updateEditingSession: sinon.stub().callsArgWith(3)
			recordEvent: sinon.stub().callsArgWith(3)

		@controller = SandboxedModule.require modulePath, requires:
			"./AnalyticsManager":@AnalyticsManager
			"../Authentication/AuthenticationController":@AuthenticationController
			"logger-sharelatex":
				log:->
			'../../infrastructure/GeoIpLookup': @GeoIpLookup =
				getDetails: sinon.stub()

		@res =
			send:->

	describe "updateEditingSession", ->
		beforeEach ->
			@req =
				params:
					projectId: "a project id"
			@GeoIpLookup.getDetails = sinon.stub()
				.callsArgWith(1, null, {country_code: 'XY'})

		it "delegates to the AnalyticsManager", (done) ->
			@AuthenticationController.getLoggedInUserId.returns("1234")
			@controller.updateEditingSession @req, @res

			@AnalyticsManager.updateEditingSession.calledWith(
				"1234",
				"a project id",
				'XY'
			).should.equal true
			done()

	describe "recordEvent", ->
		beforeEach ->
			@req =
				params:
					event:"i_did_something"
				body:"stuff"
				sessionID: "sessionIDHere"
				session: {}

		it "should use the user_id", (done)->
			@AuthenticationController.getLoggedInUserId.returns("1234")
			@controller.recordEvent @req, @res
			@AnalyticsManager.recordEvent.calledWith("1234", @req.params["event"], @req.body).should.equal true
			done()

		it "should use the session id", (done)->
			@controller.recordEvent @req, @res
			@AnalyticsManager.recordEvent.calledWith(@req.sessionID, @req.params["event"], @req.body).should.equal true
			done()
