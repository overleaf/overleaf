child   = require "child_process"
fs = require "fs"
assert = require("assert")
chai = require("chai")
chai.should()
expect = chai.expect
Settings = require "settings-sharelatex"
port = Settings.internal?.web?.port or Settings.port or 3000
cookeFilePath = "/tmp/smoke-test-cookie-#{port}.txt"
buildUrl = (path) -> " -b #{cookeFilePath} --resolve 'smoke#{Settings.cookieDomain}:#{port}:127.0.0.1' http://smoke#{Settings.cookieDomain}:#{port}/#{path}?setLng=en"

describe "Opening", ->

	before (done) ->
		require("../../../app/js/Features/Security/LoginRateLimiter.js").recordSuccessfulLogin Settings.smokeTest.user, ->
			command =  """
				curl -H  "X-Forwarded-Proto: https" -c #{cookeFilePath} #{buildUrl('register')}
			"""
			child.exec command, (err, stdout, stderr)->
				if err? then done(err)
				csrfMatches = stdout.match("<input name=\"_csrf\" type=\"hidden\" value=\"(.*?)\">")
				if !csrfMatches?
					logger.err stdout:stdout, "smoke test: does not hace csrf token"
					return("smoke test: does not hace csrf token")
				csrf = csrfMatches[1]

				# Change cookie to be non secure so curl will send it
				fs = require("fs")
				fs.readFile cookeFilePath, "utf8", (err, data) ->
					return done(err) if err
					firstTrue = data.indexOf("TRUE")
					secondTrue = data.indexOf("TRUE", firstTrue+4)
					result = data.slice(0, secondTrue)+"FALSE"+data.slice(secondTrue+4)
					fs.writeFile cookeFilePath, result, "utf8", (err) ->
						return done(err) if err

						command = """
							curl -H "Content-Type: application/json" -H "X-Forwarded-Proto: https" -d '{"_csrf":"#{csrf}", "email":"#{Settings.smokeTest.user}", "password":"#{Settings.smokeTest.password}"}' #{buildUrl('register')}
						"""
						child.exec command, done

	after (done)-> 
		command =  """
			curl -H  "X-Forwarded-Proto: https" -c #{cookeFilePath} #{buildUrl('logout')}
		"""
		child.exec command, (err, stdout, stderr)->
			if err?
				return done(err)
			fs.unlink cookeFilePath, done

	it "a project", (done) ->
		@timeout(4000)
		command =  """
			curl -H "X-Forwarded-Proto: https" -v #{buildUrl("project/#{Settings.smokeTest.projectId}")}
		"""
		child.exec command, (error, stdout, stderr)->
			expect(error, "smoke test: error in getting project").to.not.exist
		
			statusCodeMatch = !!stderr.match("200 OK")
			expect(statusCodeMatch, "smoke test: response code is not 200 getting project").to.equal true
			
			# Check that the project id is present in the javascript that loads up the project
			match = !!stdout.match("window.project_id = \"#{Settings.smokeTest.projectId}\"")
			expect(match, "smoke test: project page html does not have project_id").to.equal true
			done()


	it "the project list", (done) ->
		@timeout(4000)
		command =  """
			curl -H "X-Forwarded-Proto: https" -v #{buildUrl("project")}
		"""
		child.exec command, (error, stdout, stderr)->
		
			expect(error, "smoke test: error returned in getting project list").to.not.exist
			expect(!!stderr.match("200 OK"), "smoke test: response code is not 200 getting project list").to.equal true
			expect(!!stdout.match("<title>Your Projects - ShareLaTeX, Online LaTeX Editor</title>"), "smoke test: body does not have correct title").to.equal true
			expect(!!stdout.match("ProjectPageController"), "smoke test: body does not have correct angular controller").to.equal true
			done()
	

