child   = require "child_process"
fs = require "fs"
assert = require("assert")
chai = require("chai")
chai.should()
expect = chai.expect
Settings = require "settings-sharelatex"


port = Settings.internal?.web?.port or Settings.port or 3000
buildUrl = (path) -> "http://www.sharelatex.dev:#{port}/#{path}"


describe "Opening", ->

	before (done) ->

		command =  "curl -b cookies.txt -c cookies.txt #{buildUrl('register')}"
		child.exec command, (err, stdout, stderr)->
			csrf = stdout.match("<input name=\"_csrf\" type=\"hidden\" value=\"(.*?)\">")[1]

			command = """
				curl -b cookies.txt -c cookies.txt -H "Content-Type: application/json" -d '{"_csrf":"#{csrf}", "email":"#{Settings.smokeTest.user}", "password":"#{Settings.smokeTest.password}"}' http://www.sharelatex.dev:3000/register
			"""
			console.log csrf

			child.exec command, (err, stdout, stderr)->
				done()

	after (done)-> 
		fs.unlink "cookies.txt", done
	

	it "a project", (done) ->

		# request {
		# 	url: buildUrl("project/#{Settings.smokeTest.projectId}")
		# 	headers:
		# 		"X-Forwarded-Proto": "https"
		# }, (error, response, body) ->
		# 	expect(error, "smoke test: error in getting project").to.not.exist
		# 	expect(response.statusCode, "smoke test: response code is not 200 getting project").to.equal(200)
		# 	# Check that the project id is present in the javascript that loads up the project
		# 	match = !!body.match("window.project_id = \"#{Settings.smokeTest.projectId}\"")
		# 	expect(match, "smoke test: project page html does not have project_id").to.equal true
		# 	done()
		done()


	it "the project list", (done) ->
		# request {
		# 	url: buildUrl("project")
		# 	headers:
		# 		"X-Forwarded-Proto": "https"
		# }, (error, response, body) ->
		# 	expect(error, "smoke test: error returned in getting project list").to.not.exist
		# 	expect(response.statusCode, "smoke test: response code is not 200 getting project list").to.equal(200)
		# 	expect(!!body.match("<title>Your Projects - ShareLaTeX, Online LaTeX Editor</title>"), "smoke test: body does not have correct title").to.equal true
		# 	expect(!!body.match("ProjectPageController"), "smoke test: body does not have correct angular controller").to.equal true
		# 	done()
		done()
	

