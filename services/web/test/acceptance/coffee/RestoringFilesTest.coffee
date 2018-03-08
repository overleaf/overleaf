async = require "async"
expect = require("chai").expect

ProjectGetter = require "../../../app/js/Features/Project/ProjectGetter.js"

User = require "./helpers/User"
MockProjectHistoryApi = require "./helpers/MockProjectHistoryApi"
MockDocstoreApi = require "./helpers/MockDocstoreApi"

describe "RestoringFiles", ->
	before (done) ->
		@owner = new User()
		@owner.login (error) =>
			throw error if error?
			@owner.createProject "example-project", {template: "example"}, (error, @project_id) =>
				throw error if error?
				done()

	describe "restoring a text file", ->
		beforeEach (done) ->
			MockProjectHistoryApi.addOldFile(@project_id, 42, "foo.tex", "hello world, this is foo.tex!")
			@owner.request {
				method: "POST",
				url: "/project/#{@project_id}/restore_file",
				json:
					pathname: "foo.tex"
					version: 42
			}, (error, response, body) ->
				throw error if error?
				expect(response.statusCode).to.equal 204
				done()

		it "should have created a doc", ->
			@owner.getProject @project_id, (error, project) =>
				throw error if error?
				doc = _.find project.rootFolder[0].docs, (doc) ->
					doc.name == 'foo.tex'
				doc = MockDocstoreApi.docs[@project_id][doc._id]
				expect(doc.lines).to.deep.equal [
					"hello world, this is foo.tex!"
				]
				done()

	describe "restoring a binary file", ->
		it "should have created a file"

	describe "restoring to a directory that no longer exists", ->
		it "should have created the file in the root folder"

	describe "restoring to a filename that already exists", ->
		it "should have created the file with a timestamp appended"
