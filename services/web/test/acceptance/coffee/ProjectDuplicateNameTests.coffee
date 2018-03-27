async = require "async"
expect = require("chai").expect
sinon = require "sinon"
mkdirp = require "mkdirp"
ObjectId = require("mongojs").ObjectId
Path = require "path"
fs = require "fs"
Settings = require "settings-sharelatex"
_ = require "underscore"

ProjectGetter = require "../../../app/js/Features/Project/ProjectGetter.js"

MockDocStoreApi = require './helpers/MockDocstoreApi'
MockFileStoreApi = require './helpers/MockFileStoreApi'
request = require "./helpers/request"
User = require "./helpers/User"

describe "ProjectDuplicateNames", ->
	before (done) ->
		@owner = new User()
		@owner.login done
		@project = {}
		@callback = sinon.stub()

	describe "creating a project from the example template", ->
		before (done) ->
			@owner.createProject "example-project", {template: "example"}, (error, project_id) =>
				throw error if error?
				@example_project_id = project_id
				@owner.getProject project_id, (error, project) =>
					@project = project
					@mainTexDoc = _.find(project.rootFolder[0].docs, (doc) -> doc.name is 'main.tex')
					@refBibDoc = _.find(project.rootFolder[0].docs, (doc) -> doc.name is 'references.bib')
					@imageFile = _.find(project.rootFolder[0].fileRefs, (file) -> file.name is 'universe.jpg')
					@rootFolderId = project.rootFolder[0]._id.toString()
					# create a folder called 'testfolder'
					@owner.request.post {
							uri: "/project/#{@example_project_id}/folder"
							json:
								name: "testfolder"
								parent_folder_id: @rootFolderId
					}, (err, res, body) =>
							@testFolderId = body._id
							done()

		it "should create a project", ->
			expect(@project.rootFolder[0].docs.length).to.equal(2)
			expect(@project.rootFolder[0].fileRefs.length).to.equal(1)

		it "should create two docs in the docstore", ->
			docs = MockDocStoreApi.docs[@example_project_id]
			expect(Object.keys(docs).length).to.equal(2)

		it "should create one file in the filestore", ->
			files = MockFileStoreApi.files[@example_project_id]
			expect(Object.keys(files).length).to.equal(1)

		describe "for an existing doc", ->
			describe "trying to add a doc with the same name", ->
				before (done) ->
					@owner.request.post {
						uri: "/project/#{@example_project_id}/doc"
						json:
							name: "main.tex"
							parent_folder_id: @rootFolderId
					}, (err, res, body) =>
						@res = res
						done()

				it "should respond with 400 error status", ->
					expect(@res.statusCode).to.equal 400

			describe "trying to add a folder with the same name", ->
				before (done) ->
					@owner.request.post {
						uri: "/project/#{@example_project_id}/folder"
						json:
							name: "main.tex"
							parent_folder_id: @rootFolderId
					}, (err, res, body) =>
						@res = res
						done()

				it "should respond with 400 error status", ->
					expect(@res.statusCode).to.equal 400

			describe "trying to upload a file with the same name", ->
				before (done) ->
					@owner.request.post
						uri: "/project/#{@example_project_id}/upload"
						json: true
						qs:
							folder_id: @rootFolderId
							qqfilename: "main.tex"
						formData:
							qqfile:
								value:	fs.createReadStream Path.resolve(__dirname + '/../files/1pixel.png')
								options:
									filename: 'main.tex',
									contentType: 'image/png'
					, (err, res, body) =>
						@body = body
						done()

				it "should respond with failure status", ->
					expect(@body.success).to.equal false

			describe "trying to add a folder with the same name", ->
				before (done) ->
					@owner.request.post {
						uri: "/project/#{@example_project_id}/folder"
						json:
							name: "main.tex"
							parent_folder_id: @rootFolderId
					}, (err, res, body) =>
						@res = res
						done()

				it "should respond with 400 error status", ->
					expect(@res.statusCode).to.equal 400

			describe "trying to upload a file with the same name", ->
				before (done) ->
					@owner.request.post
						uri: "/project/#{@example_project_id}/upload"
						json: true
						qs:
							folder_id: @rootFolderId
							qqfilename: "main.tex"
						formData:
							qqfile:
								value:	fs.createReadStream Path.resolve(__dirname + '/../files/1pixel.png')
								options:
									filename: 'main.tex',
									contentType: 'image/png'
					, (err, res, body) =>
						@body = body
						done()

				it "should respond with failure status", ->
					expect(@body.success).to.equal false


		describe "for an existing file", ->
			describe "trying to add a doc with the same name", ->
				before (done) ->
					@owner.request.post {
						uri: "/project/#{@example_project_id}/doc"
						json:
							name: "universe.jpg"
							parent_folder_id: @rootFolderId
					}, (err, res, body) =>
						@res = res
						done()

				it "should respond with 400 error status", ->
					expect(@res.statusCode).to.equal 400

			describe "trying to add a folder with the same name", ->
				before (done) ->
					@owner.request.post {
						uri: "/project/#{@example_project_id}/folder"
						json:
							name: "universe.jpg"
							parent_folder_id: @rootFolderId
					}, (err, res, body) =>
						@res = res
						done()

				it "should respond with 400 error status", ->
					expect(@res.statusCode).to.equal 400

			describe "trying to upload a file with the same name", ->
				before (done) ->
					@owner.request.post
						uri: "/project/#{@example_project_id}/upload"
						json: true
						qs:
							folder_id: @rootFolderId
							qqfilename: "universe.jpg"
						formData:
							qqfile:
								value:	fs.createReadStream Path.resolve(__dirname + '/../files/1pixel.png')
								options:
									filename: 'universe.jpg',
									contentType: 'image/jpeg'
					, (err, res, body) =>
						@body = body
						# update the image id because we have replaced the file
						@imageFile._id = @body.entity_id
						done()

				it "should succeed (overwriting the file)", ->
					expect(@body.success).to.equal true
				# at this point the @imageFile._id has changed

		describe "for an existing folder", ->
			describe "trying to add a doc with the same name", ->
				before (done) ->
					@owner.request.post {
						uri: "/project/#{@example_project_id}/doc"
						json:
							name: "testfolder"
							parent_folder_id: @rootFolderId
					}, (err, res, body) =>
						@res = res
						done()

				it "should respond with 400 error status", ->
					expect(@res.statusCode).to.equal 400

			describe "trying to add a folder with the same name", ->
				before (done) ->
					@owner.request.post {
						uri: "/project/#{@example_project_id}/folder"
						json:
							name: "testfolder"
							parent_folder_id: @rootFolderId
					}, (err, res, body) =>
						@res = res
						done()

				it "should respond with 400 error status", ->
					expect(@res.statusCode).to.equal 400

			describe "trying to upload a file with the same name", ->
				before (done) ->
					@owner.request.post
						uri: "/project/#{@example_project_id}/upload"
						json: true
						qs:
							folder_id: @rootFolderId
							qqfilename: "universe.jpg"
						formData:
							qqfile:
								value:	fs.createReadStream Path.resolve(__dirname + '/../files/1pixel.png')
								options:
									filename: 'testfolder',
									contentType: 'image/jpeg'
					, (err, res, body) =>
						@body = body
						done()

				it "should respond with failure status", ->
					expect(@body.success).to.equal false


		describe "for an existing doc", ->
			describe "trying to rename a doc to the same name", ->
				before (done) ->
					@owner.request.post {
						uri: "/project/#{@example_project_id}/doc/#{@refBibDoc._id}/rename"
						json:
							name: "main.tex"
					}, (err, res, body) =>
						@res = res
						done()

				it "should respond with 400 error status", ->
					expect(@res.statusCode).to.equal 400

			describe "trying to rename a folder to the same name", ->
				before (done) ->
					@owner.request.post {
						uri: "/project/#{@example_project_id}/folder/#{@testFolderId}/rename"
						json:
							name: "main.tex"
					}, (err, res, body) =>
						@res = res
						done()

				it "should respond with 400 error status", ->
					expect(@res.statusCode).to.equal 400

			describe "trying to rename a file to the same name", ->
				before (done) ->
					@owner.request.post {
						uri: "/project/#{@example_project_id}/file/#{@imageFile._id}/rename"
						json:
							name: "main.tex"
					}, (err, res, body) =>
						@res = res
						done()

				it "should respond with failure status", ->
					expect(@res.statusCode).to.equal 400


		describe "for an existing file", ->
			describe "trying to rename a doc to the same name", ->
				before (done) ->
					@owner.request.post {
						uri: "/project/#{@example_project_id}/doc/#{@refBibDoc._id}/rename"
						json:
							name: "universe.jpg"
					}, (err, res, body) =>
						@res = res
						done()

				it "should respond with 400 error status", ->
					expect(@res.statusCode).to.equal 400

			describe "trying to rename a folder to the same name", ->
				before (done) ->
					@owner.request.post {
						uri: "/project/#{@example_project_id}/folder/#{@testFolderId}/rename"
						json:
							name: "universe.jpg"
					}, (err, res, body) =>
						@res = res
						done()

				it "should respond with 400 error status", ->
					expect(@res.statusCode).to.equal 400

			describe "trying to rename a file to the same name", ->
				before (done) ->
					@owner.request.post {
						uri: "/project/#{@example_project_id}/file/#{@imageFile._id}/rename"
						json:
							name: "universe.jpg"
					}, (err, res, body) =>
						@res = res
						done()

				it "should respond with failure status", ->
					expect(@res.statusCode).to.equal 400


		describe "for an existing folder", ->
			describe "trying to rename a doc to the same name", ->
				before (done) ->
					@owner.request.post {
						uri: "/project/#{@example_project_id}/doc/#{@refBibDoc._id}/rename"
						json:
							name: "testfolder"
					}, (err, res, body) =>
						@res = res
						done()

				it "should respond with 400 error status", ->
					expect(@res.statusCode).to.equal 400

			describe "trying to rename a folder to the same name", ->
				before (done) ->
					@owner.request.post {
						uri: "/project/#{@example_project_id}/folder/#{@testFolderId}/rename"
						json:
							name: "testfolder"
					}, (err, res, body) =>
						@res = res
						done()

				it "should respond with 400 error status", ->
					expect(@res.statusCode).to.equal 400

			describe "trying to rename a file to the same name", ->
				before (done) ->
					@owner.request.post {
						uri: "/project/#{@example_project_id}/file/#{@imageFile._id}/rename"
						json:
							name: "testfolder"
					}, (err, res, body) =>
						@res = res
						done()

				it "should respond with failure status", ->
					expect(@res.statusCode).to.equal 400


		describe "for an existing folder with a file with the same name", ->
			before (done) ->
				@owner.request.post {
					uri: "/project/#{@example_project_id}/doc"
					json:
						name: "main.tex"
						parent_folder_id: @testFolderId
				}, (err, res, body) =>
					@owner.request.post {
						uri: "/project/#{@example_project_id}/doc"
						json:
							name: "universe.jpg"
							parent_folder_id: @testFolderId
					}, (err, res, body) =>
						@owner.request.post {
							uri: "/project/#{@example_project_id}/folder"
							json:
								name: "otherFolder"
								parent_folder_id: @testFolderId
						}, (err, res, body) =>
							@subFolderId = body._id
							@owner.request.post {
								uri: "/project/#{@example_project_id}/folder"
								json:
									name: "otherFolder"
									parent_folder_id: @rootFolderId
							}, (err, res, body) =>
								@otherFolderId = body._id
								done()

			describe "trying to move a doc into the folder", ->
				before (done) ->
					@owner.request.post {
						uri: "/project/#{@example_project_id}/doc/#{@mainTexDoc._id}/move"
						json:
							folder_id: @testFolderId
					}, (err, res, body) =>
						@res = res
						done()

				it "should respond with 400 error status", ->
					expect(@res.statusCode).to.equal 400

			describe "trying to move a file into the folder", ->
				before (done) ->
					@owner.request.post {
						uri: "/project/#{@example_project_id}/file/#{@imageFile._id}/move"
						json:
							folder_id: @testFolderId
					}, (err, res, body) =>
						@res = res
						done()

				it "should respond with 400 error status", ->
					expect(@res.statusCode).to.equal 400

			describe "trying to move a folder into the folder", ->
				before (done) ->
					@owner.request.post {
						uri: "/project/#{@example_project_id}/folder/#{@otherFolderId}/move"
						json:
							folder_id: @testFolderId
					}, (err, res, body) =>
						@res = res
						done()

				it "should respond with 400 error status", ->
					expect(@res.statusCode).to.equal 400

			describe "trying to move a folder into a subfolder of itself", ->
				before (done) ->
					@owner.request.post {
						uri: "/project/#{@example_project_id}/folder/#{@testFolderId}/move"
						json:
							folder_id: @subFolderId
					}, (err, res, body) =>
						@res = res
						done()

				it "should respond with 400 error status", ->
					expect(@res.statusCode).to.equal 400
