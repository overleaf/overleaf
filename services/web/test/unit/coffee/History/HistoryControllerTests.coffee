chai = require('chai')
chai.should()
sinon = require("sinon")
modulePath = "../../../../app/js/Features/History/HistoryController"
SandboxedModule = require('sandboxed-module')

describe "HistoryController", ->
	beforeEach ->
		@callback = sinon.stub()
		@user_id = "user-id-123"
		@AuthenticationController =
			getLoggedInUserId: sinon.stub().returns(@user_id)
		@HistoryController = SandboxedModule.require modulePath, requires:
			"request" : @request = sinon.stub()
			"settings-sharelatex": @settings = {}
			"logger-sharelatex": @logger = {log: sinon.stub(), error: sinon.stub()}
			"./HistoryManager": @HistoryManager = {}
			"../Authentication/AuthenticationController": @AuthenticationController
			"../Project/ProjectDetailsHandler": @ProjectDetailsHandler = {}
		@settings.apis =
			trackchanges:
				enabled: false
				url: "http://trackchanges.example.com"
			project_history:
				url: "http://project_history.example.com"

	describe "selectHistoryApi", ->
		beforeEach ->
			@req = { url: "/mock/url", method: "POST" }
			@res = "mock-res"
			@next = sinon.stub()

		describe "for a project with project history", ->
			beforeEach ->
				@ProjectDetailsHandler.getDetails = sinon.stub().callsArgWith(1, null, {overleaf:{history:{id: 42, display:true}}})
				@HistoryController.selectHistoryApi @req, @res, @next

			it "should set the flag for project history to true", ->
				@req.useProjectHistory.should.equal true

		describe "for any other project ", ->
			beforeEach ->
				@ProjectDetailsHandler.getDetails = sinon.stub().callsArgWith(1, null, {})
				@HistoryController.selectHistoryApi @req, @res, @next

			it "should not set the flag for project history to false", ->
				@req.useProjectHistory.should.equal false


	describe "proxyToHistoryApi", ->
		beforeEach ->
			@req = { url: "/mock/url", method: "POST" }
			@res = "mock-res"
			@next = sinon.stub()
			@proxy =
				events: {}
				pipe: sinon.stub()
				on: (event, handler) -> @events[event] = handler
			@request.returns @proxy

		describe "for a project with the project history flag", ->
			beforeEach ->
				@req.useProjectHistory = true
				@HistoryController.proxyToHistoryApi @req, @res, @next

			it "should get the user id", ->
				@AuthenticationController.getLoggedInUserId
					.calledWith(@req)
					.should.equal true

			it "should call the project history api", ->
				@request
					.calledWith({
						url: "#{@settings.apis.project_history.url}#{@req.url}"
						method: @req.method
						headers:
							"X-User-Id": @user_id
					})
					.should.equal true

			it "should pipe the response to the client", ->
				@proxy.pipe
					.calledWith(@res)
					.should.equal true

		describe "for a project without the project history flag", ->
			beforeEach ->
				@req.useProjectHistory = false
				@HistoryController.proxyToHistoryApi @req, @res, @next

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
				@HistoryController.proxyToHistoryApi @req, @res, @next
				@proxy.events["error"].call(@proxy, @error = new Error("oops"))

			it "should pass the error up the call chain", ->
				@next.calledWith(@error).should.equal true

	describe "proxyToHistoryApiAndInjectUserDetails", ->
		beforeEach ->
			@req = { url: "/mock/url", method: "POST" }
			@res =
				json: sinon.stub()
			@next = sinon.stub()
			@request.yields(null, {statusCode: 200}, @data = "mock-data")
			@HistoryManager.injectUserDetails = sinon.stub().yields(null, @data_with_users = "mock-injected-data")

		describe "for a project with the project history flag", ->
			beforeEach ->
				@req.useProjectHistory = true
				@HistoryController.proxyToHistoryApiAndInjectUserDetails @req, @res, @next

			it "should get the user id", ->
				@AuthenticationController.getLoggedInUserId
					.calledWith(@req)
					.should.equal true

			it "should call the project history api", ->
				@request
					.calledWith({
						url: "#{@settings.apis.project_history.url}#{@req.url}"
						method: @req.method
						json: true
						headers:
							"X-User-Id": @user_id
					})
					.should.equal true

			it "should inject the user data", ->
				@HistoryManager.injectUserDetails
					.calledWith(@data)
					.should.equal true

			it "should return the data with users to the client", ->
				@res.json.calledWith(@data_with_users).should.equal true

		describe "for a project without the project history flag", ->
			beforeEach ->
				@req.useProjectHistory = false
				@HistoryController.proxyToHistoryApiAndInjectUserDetails @req, @res, @next

			it "should get the user id", ->
				@AuthenticationController.getLoggedInUserId
					.calledWith(@req)
					.should.equal true

			it "should call the track changes api", ->
				@request
					.calledWith({
						url: "#{@settings.apis.trackchanges.url}#{@req.url}"
						method: @req.method
						json: true
						headers:
							"X-User-Id": @user_id
					})
					.should.equal true

			it "should inject the user data", ->
				@HistoryManager.injectUserDetails
					.calledWith(@data)
					.should.equal true

			it "should return the data with users to the client", ->
				@res.json.calledWith(@data_with_users).should.equal true
