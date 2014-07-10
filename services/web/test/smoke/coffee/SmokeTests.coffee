chai = require("chai")
chai.should()
expect = chai.expect
Settings = require "settings-sharelatex"

# Monkey patch request cookies, because the new tough-cookie module
# assumes it's not a secure cookie if the url is not HTTPS
request = require "request"
jar = request.jar()
jar.getCookieString = (uri) ->
	return @_jar.getCookieStringSync uri, secure: true
request = request.defaults jar: jar

port = Settings.internal?.web?.port or Settings.port or 3000
buildUrl = (path) -> "http://localhost:#{port}/#{path}"

describe "Opening", ->
	before (done) ->
		request.get {
			url: buildUrl("register")
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
				headers:
					"X-Forwarded-Proto": "https"
			}, (error, response, body) ->
				throw error if error?
				done()

	after (done)->
		request.get {
			url: buildUrl("logout")
			headers:
				"X-Forwarded-Proto": "https"
		}, (error, response, body) =>
			throw error if error?
			done()



	it "a project", (done) ->
		request {
			url: buildUrl("project/#{Settings.smokeTest.projectId}")
			headers:
				"X-Forwarded-Proto": "https"
		}, (error, response, body) ->
			expect(error, "smoke test: error in getting project").to.not.exist
			expect(response.statusCode, "smoke test: response code is not 200 getting project").to.equal(200)
			# Check that the project id is present in the javascript that loads up the project
			match = !!body.match("window.project_id = \"#{Settings.smokeTest.projectId}\"")
			expect(match, "smoke test: project page html does not have project_id").to.equal true
			done()

	it "the project list", (done) ->
		request {
			url: buildUrl("project")
			headers:
				"X-Forwarded-Proto": "https"
		}, (error, response, body) ->
			expect(error, "smoke test: error returned in getting project list").to.not.exist
			expect(response.statusCode, "smoke test: response code is not 200 getting project list").to.equal(200)
			expect(!!body.match("<title>Your Projects - Online LaTeX Editor ShareLaTeX</title>"), "smoke test: body does not have correct title").to.equal true
			expect(!!body.match("ProjectPageController"), "smoke test: body does not have correct angular controller").to.equal true
			done()
	
