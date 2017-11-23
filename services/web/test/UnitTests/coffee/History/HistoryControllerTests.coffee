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
				@ProjectDetailsHandler.getDetails = sinon.stub().callsArgWith(1, null, {overleaf:{history:{}}})
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

		describe "with project history enabled", ->
			beforeEach ->
				@settings.apis.project_history.enabled = true

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

		describe "with project history disabled", ->
			beforeEach ->
				@settings.apis.project_history.enabled = false

			describe "for a project with the project history flag", ->
				beforeEach ->
					@req.useProjectHistory = true
					@HistoryController.proxyToHistoryApi @req, @res, @next

				it "should call the track changes api", ->
					@request
						.calledWith({
							url: "#{@settings.apis.trackchanges.url}#{@req.url}"
							method: @req.method
							headers:
								"X-User-Id": @user_id
						})
						.should.equal true

			describe "for a project without the project history flag", ->
				beforeEach ->
					@req.useProjectHistory = false
					@HistoryController.proxyToHistoryApi @req, @res, @next

				it "should call the track changes api", ->
					@request
						.calledWith({
							url: "#{@settings.apis.trackchanges.url}#{@req.url}"
							method: @req.method
							headers:
								"X-User-Id": @user_id
						})
						.should.equal true

		describe "with an error", ->
			beforeEach ->
				@HistoryController.proxyToHistoryApi @req, @res, @next
				@proxy.events["error"].call(@proxy, @error = new Error("oops"))

			it "should pass the error up the call chain", ->
				@next.calledWith(@error).should.equal true

	describe "initializeProject", ->
		describe "with project history enabled", ->
			beforeEach ->
				@settings.apis.project_history.enabled = true

			describe "project history returns a successful response", ->
				beforeEach ->
					@overleaf_id = 1234
					@res = statusCode: 200
					@body = JSON.stringify(project: id: @overleaf_id)
					@request.post = sinon.stub().callsArgWith(1, null, @res, @body)

					@HistoryController.initializeProject @callback

				it "should call the project history api", ->
					@request.post.calledWith(
						url: "#{@settings.apis.project_history.url}/project"
					).should.equal true

				it "should return the callback with the overleaf id", ->
					@callback.calledWithExactly(null, { @overleaf_id }).should.equal true

			describe "project history returns a response without the project id", ->
				beforeEach ->
					@res = statusCode: 200
					@body = JSON.stringify(project: {})
					@request.post = sinon.stub().callsArgWith(1, null, @res, @body)

					@HistoryController.initializeProject @callback

				it "should return the callback with an error", ->
					@callback
						.calledWith(sinon.match.has("message", "project-history did not provide an id"))
						.should.equal true

			describe "project history returns a unsuccessful response", ->
				beforeEach ->
					@res = statusCode: 404
					@request.post = sinon.stub().callsArgWith(1, null, @res)

					@HistoryController.initializeProject @callback

				it "should return the callback with an error", ->
					@callback
						.calledWith(sinon.match.has("message", "project-history returned a non-success status code: 404"))
						.should.equal true

			describe "project history errors", ->
				beforeEach ->
					@error = sinon.stub()
					@request.post = sinon.stub().callsArgWith(1, @error)

					@HistoryController.initializeProject @callback

				it "should return the callback with the error", ->
					@callback.calledWithExactly(@error).should.equal true

		describe "with project history disabled", ->
			beforeEach ->
				@settings.apis.project_history.enabled = false
				@HistoryController.initializeProject @callback

			it "should return the callback", ->
				@callback.calledWithExactly().should.equal true
