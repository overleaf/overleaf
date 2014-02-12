chai = require("chai")
chai.should()
expect = chai.expect
request = require "request"
Settings = require "settings-sharelatex"

port = Settings.internal?.web?.port or Settings.port or 3000
buildUrl = (path) -> "http://localhost:#{port}/#{path}"

describe "Opening", ->
	before (done) ->
		@jar = request.jar()
		request.get {
			url: buildUrl("register")
			jar: @jar
			headers:
				"X-Forwarded-Proto": "https"
		}, (error, response, body) =>
			csrf = body.match("<input name=\"_csrf\" type=\"hidden\" value=\"(.*?)\">")[1]
			request.post {
				url: buildUrl("register")
				form:
					email: Settings.smokeTest.user
					password: Settings.smokeTest.password
					_csrf: csrf
				jar: @jar
				headers:
					"X-Forwarded-Proto": "https"
			}, (error, response, body) ->
				throw error if error?
				done()

	it "a project", (done) ->
		request {
			url: buildUrl("project/#{Settings.smokeTest.projectId}")
			jar: @jar
			headers:
				"X-Forwarded-Proto": "https"
		}, (error, response, body) ->
			# Check that the project id is present in the javascript that loads up the project
			match = !!body.match("\"project_id\":\"#{Settings.smokeTest.projectId}\"")
			expect(match).to.equal true
			done()

	it "the project list", (done) ->
		request {
			url: buildUrl("project")
			jar: @jar
			headers:
				"X-Forwarded-Proto": "https"
		}, (error, response, body) ->
			expect(!!body.match("<title>Your Projects - Online LaTeX Editor ShareLaTeX</title>")).to.equal true
			expect(!!body.match("<h1>Projects</h1>")).to.equal true
			done()
	
