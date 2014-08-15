sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Authentication/AuthenticationController.js"
SandboxedModule = require('sandboxed-module')

describe "AuthenticationController", ->
	beforeEach ->
		@AuthenticationController = SandboxedModule.require modulePath, requires:
			"../WebApi/WebApiManager": @WebApiManager = {}
			"../Users/UserFormatter": @UserFormatter = {}
			"logger-sharelatex": @logger = { log: sinon.stub() }
		@callback = sinon.stub()

	describe "authClient", ->
		beforeEach ->
			@auth_token = "super-secret-auth-token"
			@client =
				params: {}
				set: (key, value, callback) ->
					@params[key] = value
					callback()
			@user =
				id: "user-id-123"
				email: "doug@sharelatex.com"
				first_name: "Douglas"
				last_name: "Adams"
			@WebApiManager.getUserDetailsFromAuthToken = sinon.stub().callsArgWith(1, null, @user)
			@UserFormatter.formatUserForClientSide = sinon.stub().returns({
				id: @user.id
				first_name: @user.first_name
				last_name: @user.last_name
				email: @user.email
				gravatar_url: "//gravatar/url"
			})
			@AuthenticationController.authClient(@client, auth_token: @auth_token, @callback)

		it "should get the user's data from the web api", ->
			@WebApiManager.getUserDetailsFromAuthToken
				.calledWith(@auth_token)
				.should.equal true

		it "should set the user's data and auth_token on the client object", ->
			@client.params.should.deep.equal {
				id: @user.id
				first_name: @user.first_name
				last_name: @user.last_name
				email: @user.email
				gravatar_url: "//gravatar/url"
				auth_token: @auth_token
			}

		it "should call the callback with the user details (including the gravatar URL, but not the auth_token)", ->
			@callback
				.calledWith(null, {
					id: @user.id
					email: @user.email
					first_name: @user.first_name
					last_name: @user.last_name
					gravatar_url: "//gravatar/url"
				}).should.equal true

		it "should log the request", ->
			@logger.log
				.calledWith(auth_token: @auth_token, "authenticating user")
				.should.equal true
			@logger.log
				.calledWith(user: @user, auth_token: @auth_token, "authenticated user")
				.should.equal true

