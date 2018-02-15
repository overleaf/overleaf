expect = require("chai").expect
ProjectGetter = require "../../../app/js/Features/Project/ProjectGetter.js"
request = require "./helpers/request"
User = require "./helpers/User"

describe "TpdsUpdateTests", ->
	before (done) ->
		@owner = new User()
		@owner.login (error) =>
			throw error if error?
			@owner.createProject "test-project", {template: "example"}, (error, project_id) =>
				throw error if error?
				@project_id = project_id
				done()

	describe "deleting a file", ->
		before (done) ->
			request {
				method: "DELETE"
				url: "/project/#{@project_id}/contents/main.tex"
				auth:
					username: "sharelatex"
					password: "password"
					sendImmediately: true
			}, (error, response, body) ->
				throw error if error?
				expect(response.statusCode).to.equal 200
				done()

		it "should have deleted the file", (done) ->
			ProjectGetter.getProject @project_id, (error, project) ->
				throw error if error?
				projectFolder = project.rootFolder[0]
				for doc in projectFolder.docs
					if doc.name == "main.tex"
						throw new Error("expected main.tex to have been deleted")
				done()
