async = require "async"
expect = require("chai").expect
_ = require 'underscore'

MockFileStoreApi = require './helpers/MockFileStoreApi'
MockURLSource	= require './helpers/MockURLSource'
request = require "./helpers/request"
User = require "./helpers/User"

MockURLSource.app.get "/foo", (req, res, next) =>
	res.send('foo foo foo')
MockURLSource.app.get "/bar", (req, res, next) =>
	res.send('bar bar bar')

describe "LinkedFiles", ->
	before (done) ->
		MockURLSource.run (error) =>
			return done(error) if error?
			@owner = new User() 
			@owner.login done

	describe "creating a URL based linked file", ->
		before (done) ->
			@owner.createProject "url-linked-files-project", {template: "blank"}, (error, project_id) =>
				throw error if error?
				@project_id = project_id
				@owner.getProject project_id, (error, project) =>
					throw error if error?
					@project = project
					@root_folder_id = project.rootFolder[0]._id.toString()
					done()

		it "should download the URL and create a file with the contents and linkedFileData", (done) ->
			@owner.request.post {
				url: "/project/#{@project_id}/linked_file",
				json:
					provider: 'url'
					data: {
						url: "http://localhost:6543/foo"
					}
					parent_folder_id: @root_folder_id
					name: 'url-test-file-1'
			}, (error, response, body) =>
				throw error if error?
				expect(response.statusCode).to.equal 204
				@owner.getProject @project_id, (error, project) =>
					throw error if error?
					file = project.rootFolder[0].fileRefs[0]
					expect(file.linkedFileData).to.deep.equal({
						provider: 'url'
						url: "http://localhost:6543/foo"
					})
					@owner.request.get "/project/#{@project_id}/file/#{file._id}", (error, response, body) ->
						throw error if error?
						expect(response.statusCode).to.equal 200
						expect(body).to.equal "foo foo foo"
						done()

		it "should replace and update a URL based linked file", (done) ->
			@owner.request.post {
				url: "/project/#{@project_id}/linked_file",
				json:
					provider: 'url'
					data: {
						url: "http://localhost:6543/foo"
					}
					parent_folder_id: @root_folder_id
					name: 'url-test-file-2'
			}, (error, response, body) =>
				throw error if error?
				expect(response.statusCode).to.equal 204
				@owner.request.post {
					url: "/project/#{@project_id}/linked_file",
					json:
						provider: 'url'
						data: {
							url: "http://localhost:6543/bar"
						}
						parent_folder_id: @root_folder_id
						name: 'url-test-file-2'
				}, (error, response, body) =>
					throw error if error?
					expect(response.statusCode).to.equal 204
					@owner.getProject @project_id, (error, project) =>
						throw error if error?
						file = project.rootFolder[0].fileRefs[1]
						expect(file.linkedFileData).to.deep.equal({
							provider: 'url'
							url: "http://localhost:6543/bar"
						})
						@owner.request.get "/project/#{@project_id}/file/#{file._id}", (error, response, body) ->
							throw error if error?
							expect(response.statusCode).to.equal 200
							expect(body).to.equal "bar bar bar"
							done()

		it "should return an error if the URL does not succeed", (done) ->
			@owner.request.post {
				url: "/project/#{@project_id}/linked_file",
				json:
					provider: 'url'
					data: {
						url: "http://localhost:6543/does-not-exist"
					}
					parent_folder_id: @root_folder_id
					name: 'url-test-file-3'
			}, (error, response, body) =>
				throw error if error?
				expect(response.statusCode).to.equal 422 # unprocessable
				expect(body).to.equal(
					"Your URL could not be reached (404 status code). Please check it and try again."
				)
				done()

		it "should return an error if the URL is invalid", (done) ->
			@owner.request.post {
				url: "/project/#{@project_id}/linked_file",
				json:
					provider: 'url'
					data: {
						url: "!^$%"
					}
					parent_folder_id: @root_folder_id
					name: 'url-test-file-4'
			}, (error, response, body) =>
				throw error if error?
				expect(response.statusCode).to.equal 422 # unprocessable
				expect(body).to.equal(
					"Your URL is not valid. Please check it and try again."
				)
				done()

		it "should return an error if the URL uses a non-http protocol", (done) ->
			@owner.request.post {
				url: "/project/#{@project_id}/linked_file",
				json:
					provider: 'url'
					data: {
						url: "ftp://localhost"
					}
					parent_folder_id: @root_folder_id
					name: 'url-test-file-5'
			}, (error, response, body) =>
				throw error if error?
				expect(response.statusCode).to.equal 422 # unprocessable
				expect(body).to.equal(
					"Your URL is not valid. Please check it and try again."
				)
				done()

		it "should accept a URL withuot a leading http://, and add it", (done) ->
			@owner.request.post {
				url: "/project/#{@project_id}/linked_file",
				json:
					provider: 'url'
					data: {
						url: "http://localhost:6543/foo"
					}
					parent_folder_id: @root_folder_id
					name: 'url-test-file-6'
			}, (error, response, body) =>
				throw error if error?
				expect(response.statusCode).to.equal 204
				@owner.getProject @project_id, (error, project) =>
					throw error if error?
					file = _.find project.rootFolder[0].fileRefs, (file) ->
						file.name == 'url-test-file-6'
					expect(file.linkedFileData).to.deep.equal({
						provider: 'url'
						url: "http://localhost:6543/foo"
					})
					@owner.request.get "/project/#{@project_id}/file/#{file._id}", (error, response, body) ->
						throw error if error?
						expect(response.statusCode).to.equal 200
						expect(body).to.equal "foo foo foo"
						done()

		# TODO: Add test for asking for host that return ENOTFOUND
		# (This will probably end up handled by the proxy)