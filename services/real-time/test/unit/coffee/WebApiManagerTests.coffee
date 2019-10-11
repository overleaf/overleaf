chai = require('chai')
should = chai.should()
sinon = require("sinon")
modulePath = "../../../app/js/WebApiManager.js"
SandboxedModule = require('sandboxed-module')
{ CodedError } = require('../../../app/js/Errors')

describe 'WebApiManager', ->
	beforeEach ->
		@project_id = "project-id-123"
		@user_id = "user-id-123"
		@user = {_id: @user_id}
		@callback = sinon.stub()
		@WebApiManager = SandboxedModule.require modulePath, requires:
			"request": @request = {}
			"settings-sharelatex": @settings =
				apis:
					web:
						url: "http://web.example.com"
						user: "username"
						pass: "password"
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }

	describe "joinProject", ->
		describe "successfully", ->
			beforeEach ->
				@response = {
					project: { name: "Test project" }
					privilegeLevel: "owner",
					isRestrictedUser: true
				}
				@request.post = sinon.stub().callsArgWith(1, null, {statusCode: 200}, @response)
				@WebApiManager.joinProject @project_id, @user, @callback

			it "should send a request to web to join the project", ->
				@request.post
					.calledWith({
						url: "#{@settings.apis.web.url}/project/#{@project_id}/join"
						qs:
							user_id: @user_id
						auth:
							user: @settings.apis.web.user
							pass: @settings.apis.web.pass
							sendImmediately: true
						json: true
						jar: false
						headers: {}
					})
					.should.equal true

			it "should return the project, privilegeLevel, and restricted flag", ->
				@callback
					.calledWith(null, @response.project, @response.privilegeLevel, @response.isRestrictedUser)
					.should.equal true

		describe "with an error from web", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, {statusCode: 500}, null)
				@WebApiManager.joinProject @project_id, @user_id, @callback

			it "should call the callback with an error", ->
				@callback
					.calledWith(new Error("non-success code from web: 500"))
					.should.equal true

		describe "with no data from web", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, {statusCode: 200}, null)
				@WebApiManager.joinProject @project_id, @user_id, @callback

			it "should call the callback with an error", ->
				@callback
					.calledWith(new Error("no data returned from joinProject request"))
					.should.equal true

		describe "when the project is over its rate limit", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, {statusCode: 429}, null)
				@WebApiManager.joinProject @project_id, @user_id, @callback

			it "should call the callback with a TooManyRequests error code", ->
				@callback
					.calledWith(new CodedError("rate-limit hit when joining project", "TooManyRequests"))
					.should.equal true
