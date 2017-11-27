async = require("async")
expect = require("chai").expect
Path = require "path"
fs = require "fs"
_ = require "underscore"

ProjectGetter = require "../../../app/js/Features/Project/ProjectGetter.js"

MockDocUpdaterApi = require './helpers/MockDocUpdaterApi'
MockFileStoreApi = require './helpers/MockFileStoreApi'
MockProjectHistoryApi = require './helpers/MockProjectHistoryApi'
request = require "./helpers/request"
User = require "./helpers/User"

describe "ProjectStructureChanges", ->
	before (done) ->
		@owner = new User()
		@owner.login done

	describe "creating a project from the example template", ->
		before (done) ->
			MockDocUpdaterApi.clearProjectStructureUpdates()
			@owner.createProject "project", {template: "example"}, (error, project_id) =>
				throw error if error?
				@example_project_id = project_id
				done()

		it "should version creating a doc", ->
			updates = MockDocUpdaterApi.getProjectStructureUpdates(@example_project_id).docUpdates
			expect(updates.length).to.equal(2)
			_.each updates, (update) =>
				expect(update.userId).to.equal(@owner._id)
				expect(update.docLines).to.be.a('string')
			expect(_.where(updates, pathname: "/main.tex").length).to.equal 1
			expect(_.where(updates, pathname: "/references.bib").length).to.equal 1

		it "should version creating a file", ->
			updates = MockDocUpdaterApi.getProjectStructureUpdates(@example_project_id).fileUpdates
			expect(updates.length).to.equal(1)
			update = updates[0]
			expect(update.userId).to.equal(@owner._id)
			expect(update.pathname).to.equal("/universe.jpg")
			expect(update.url).to.be.a('string');

	describe "duplicating a project", ->
		before (done) ->
			MockDocUpdaterApi.clearProjectStructureUpdates()
			@owner.request.post {
				uri: "/Project/#{@example_project_id}/clone",
				json:
					projectName: 'new.tex'
			}, (error, res, body) =>
				throw error if error?
				if res.statusCode < 200 || res.statusCode >= 300
					throw new Error("failed to add doc #{res.statusCode}")
				@dup_project_id = body.project_id
				done()

		it "should version the dosc created", ->
			updates = MockDocUpdaterApi.getProjectStructureUpdates(@dup_project_id).docUpdates
			expect(updates.length).to.equal(2)
			_.each updates, (update) =>
				expect(update.userId).to.equal(@owner._id)
				expect(update.docLines).to.be.a('string')
			expect(_.where(updates, pathname: "/main.tex").length).to.equal(1)
			expect(_.where(updates, pathname: "/references.bib").length).to.equal(1)

		it "should version the files created", ->
			updates = MockDocUpdaterApi.getProjectStructureUpdates(@dup_project_id).fileUpdates
			expect(updates.length).to.equal(1)
			update = updates[0]
			expect(update.userId).to.equal(@owner._id)
			expect(update.pathname).to.equal("/universe.jpg")
			expect(update.url).to.be.a('string');

	describe "adding a doc", ->
		before (done) ->
			MockDocUpdaterApi.clearProjectStructureUpdates()

			ProjectGetter.getProject @example_project_id, (error, projects) =>
				throw error if error?
				@owner.request.post {
					uri: "project/#{@example_project_id}/doc",
					json:
						name: 'new.tex'
						parent_folder_id: projects[0].rootFolder[0]._id
				}, (error, res, body) =>
					throw error if error?
					if res.statusCode < 200 || res.statusCode >= 300
						throw new Error("failed to add doc #{res.statusCode}")
					done()

		it "should version the doc added", ->
			updates = MockDocUpdaterApi.getProjectStructureUpdates(@example_project_id).docUpdates
			expect(updates.length).to.equal(1)
			update = updates[0]
			expect(update.userId).to.equal(@owner._id)
			expect(update.pathname).to.equal("/new.tex")
			expect(update.docLines).to.be.a('string');

	describe "uploading a project", ->
		before (done) ->
			MockDocUpdaterApi.clearProjectStructureUpdates()

			zip_file = fs.createReadStream(Path.resolve(__dirname + '/../files/test_project.zip'))

			req = @owner.request.post {
				uri: "project/new/upload",
				formData:
					qqfile: zip_file
			}, (error, res, body) =>
				throw error if error?
				if res.statusCode < 200 || res.statusCode >= 300
					throw new Error("failed to upload project #{res.statusCode}")
				@uploaded_project_id = JSON.parse(body).project_id
				done()

		it "should version the dosc created", ->
			updates = MockDocUpdaterApi.getProjectStructureUpdates(@uploaded_project_id).docUpdates
			expect(updates.length).to.equal(1)
			update = updates[0]
			expect(update.userId).to.equal(@owner._id)
			expect(update.pathname).to.equal("/main.tex")
			expect(update.docLines).to.equal("Test")

		it "should version the files created", ->
			updates = MockDocUpdaterApi.getProjectStructureUpdates(@uploaded_project_id).fileUpdates
			expect(updates.length).to.equal(1)
			update = updates[0]
			expect(update.userId).to.equal(@owner._id)
			expect(update.pathname).to.equal("/1pixel.png")
			expect(update.url).to.be.a('string');

	describe "uploading a file", ->
		before (done) ->
			MockDocUpdaterApi.clearProjectStructureUpdates()
			ProjectGetter.getProject @example_project_id, (error, projects) =>
				throw error if error?
				@root_folder_id = projects[0].rootFolder[0]._id.toString()
				done()

		it "should version a newly uploaded file", (done) ->
			image_file = fs.createReadStream(Path.resolve(__dirname + '/../files/1pixel.png'))

			req = @owner.request.post {
				uri: "project/#{@example_project_id}/upload",
				qs:
					folder_id: @root_folder_id
				formData:
					qqfile:
						value: image_file
						options:
							filename: '1pixel.png',
							contentType: 'image/png'
			}, (error, res, body) =>
				throw error if error?
				if res.statusCode < 200 || res.statusCode >= 300
					throw new Error("failed to upload file #{res.statusCode}")

				updates = MockDocUpdaterApi.getProjectStructureUpdates(@example_project_id).fileUpdates
				expect(updates.length).to.equal(1)
				update = updates[0]
				expect(update.userId).to.equal(@owner._id)
				expect(update.pathname).to.equal("/1pixel.png")
				expect(update.url).to.be.a('string');
				@original_file_url = update.url

				done()

		it "should version a replacement file", (done) ->
			image_file = fs.createReadStream(Path.resolve(__dirname + '/../files/2pixel.png'))

			req = @owner.request.post {
				uri: "project/#{@example_project_id}/upload",
				qs:
					folder_id: @root_folder_id
				formData:
					qqfile:
						value: image_file
						options:
							filename: '1pixel.png',
							contentType: 'image/png'
			}, (error, res, body) =>
				throw error if error?
				if res.statusCode < 200 || res.statusCode >= 300
					throw new Error("failed to upload file #{res.statusCode}")

				updates = MockDocUpdaterApi.getProjectStructureUpdates(@example_project_id).fileUpdates
				expect(updates.length).to.equal(1)
				update = updates[0]
				expect(update.userId).to.equal(@owner._id)
				expect(update.pathname).to.equal("/1pixel.png")
				expect(update.url).to.be.a('string');

				done()

	describe "tpds", ->
		it "should version add a doc"
		it "should version add a new file"
		it "should version replacing a file"
