chai = require('chai')
should = chai.should()
sinon = require("sinon")
modulePath = "../../../app/js/WebApiManager.js"
SandboxedModule = require('sandboxed-module')

describe 'WebApiManager', ->
	beforeEach ->
		@project_id = "project-id-123"
		@user_id = "user-id-123"
		@callback = sinon.stub()
		@WebApiManager = SandboxedModule.require modulePath, requires:
			"request": @request = {}
			"settings-sharelatex": @settings =
				apis:
					web:
						url: "http://web.example.com"
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
	
	describe "joinProject", ->
		describe "successfully", ->
			beforeEach ->
				@response = {
					project: { name: "Test project" }
					privilegeLevel: "owner"
				}
				@request.post = sinon.stub().callsArgWith(1, null, {statusCode: 200}, @response)
				@WebApiManager.joinProject @project_id, @user_id, @callback
				
			it "should send a request to web to join the project", ->
				@request.post
					.calledWith({
						url: "#{@settings.apis.web.url}/project/#{@project_id}/join"
						qs:
							user_id: @user_id
						json: true
						jar: false
					})
					.should.equal true
					
			it "should return the project and privilegeLevel", ->
				@callback
					.calledWith(null, @response.project, @response.privilegeLevel)
					.should.equal true
					
		describe "with an error from web", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, {statusCode: 500}, null)
				@WebApiManager.joinProject @project_id, @user_id, @callback
				
			it "should call the callback with an error", ->
				@callback
					.calledWith(new Error("non-success code from web: 500"))
					.should.equal true
	