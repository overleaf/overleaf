chai = require('chai')
chai.should()
sinon = require("sinon")
modulePath = "../../../../app/js/Features/History/HistoryController"
SandboxedModule = require('sandboxed-module')

describe "HistoryController", ->
	beforeEach ->
		@user_id = "user-id-123"
		@AuthenticationController =
			getLoggedInUserId: sinon.stub().returns(@user_id)
		@HistoryController = SandboxedModule.require modulePath, requires:
			"request" : @request = sinon.stub()
			"settings-sharelatex": @settings = {}
			"logger-sharelatex": @logger = {log: sinon.stub(), error: sinon.stub()}
			"../Authentication/AuthenticationController": @AuthenticationController

	describe "proxyToHistoryApi", ->
		beforeEach ->
			@req = { url: "/mock/url", method: "POST" }
			@res = "mock-res"
			@next = sinon.stub()
			@settings.apis =
				trackchanges:
					url: "http://trackchanges.example.com"
			@proxy =
				events: {}
				pipe: sinon.stub()
				on: (event, handler) -> @events[event] = handler
			@request.returns @proxy
			@HistoryController.proxyToHistoryApi @req, @res, @next

		describe "successfully", ->
			it "should get the user id", ->
				@AuthenticationController.getLoggedInUserId
					.calledWith(@req)
					.should.equal true

			it "should call the track changes api", ->
				@request
					.calledWith({
						url: "#{@settings.apis.trackchanges.url}#{@req.url}"
						method: @req.method
						headers:
							"X-User-Id": @user_id
					})
					.should.equal true

			it "should pipe the response to the client", ->
				@proxy.pipe
					.calledWith(@res)
					.should.equal true

		describe "with an error", ->
			beforeEach ->
				@proxy.events["error"].call(@proxy, @error = new Error("oops"))

			it "should pass the error up the call chain", ->
				@next.calledWith(@error).should.equal true
