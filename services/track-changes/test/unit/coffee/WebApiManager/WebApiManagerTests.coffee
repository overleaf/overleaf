sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/WebApiManager.js"
SandboxedModule = require('sandboxed-module')

describe "WebApiManager", ->
	beforeEach ->
		@WebApiManager = SandboxedModule.require modulePath, requires:
			"request": @request = {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
			'settings-sharelatex': @settings =
				apis:
					web:
						url: "http://example.com"
						user: "sharelatex"
						pass: "password"
		@callback = sinon.stub()
		@user_id = "mock-user-id"
		@user_info =
			email: "leo@sharelatex.com"
			id: @user_id
			first_name: "Leo"
			last_nane: "Lion"
			extra_param: "blah"

	describe "getUserInfo", ->
		describe "successfully", ->
			beforeEach ->
				@body = JSON.stringify @user_info
				@request.get = sinon.stub().callsArgWith(1, null, {statusCode: 200}, @body)
				@WebApiManager.getUserInfo @user_id, @callback

			it 'should get the user from the web api', ->
				url = 
				@request.get
					.calledWith({
						url: "#{@settings.apis.web.url}/user/#{@user_id}/personal_info"
						auth:
							user: @settings.apis.web.user
							pass: @settings.apis.web.pass
							sendImmediately: true
					})
					.should.equal true

			it "should call the callback with only the email, id and names", ->
				@callback.calledWith(null, {
					id:         @user_id
					email:      @user_info.email
					first_name: @user_info.first_name
					last_name:  @user_info.last_name
				}).should.equal true

		describe "when the web API returns an error", ->
			beforeEach ->
				@request.get = sinon.stub().callsArgWith(1, @error = new Error("something went wrong"), null, null)
				@WebApiManager.getUserInfo @user_id, @callback

			it "should return an error to the callback", ->
				@callback.calledWith(@error).should.equal true

		describe "when the web returns a failure error code", ->
			beforeEach ->
				@request.get = sinon.stub().callsArgWith(1, null, { statusCode: 500 }, "")
				@WebApiManager.getUserInfo @user_id, @callback

			it "should return the callback with an error", ->
				@callback
					.calledWith(new Error("web returned failure status code: 500"))
					.should.equal true