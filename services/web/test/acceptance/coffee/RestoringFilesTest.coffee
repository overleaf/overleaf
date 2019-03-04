async = require "async"
expect = require("chai").expect
_ = require 'underscore'
fs = require 'fs'
Path = require 'path'

ProjectGetter = require "../../../app/js/Features/Project/ProjectGetter.js"

User = require "./helpers/User"
MockProjectHistoryApi = require "./helpers/MockProjectHistoryApi"
MockDocstoreApi = require "./helpers/MockDocstoreApi"
MockFileStoreApi = require "./helpers/MockFileStoreApi"

describe "RestoringFiles", ->
	before (done) ->
		@owner = new User()
		@owner.login (error) =>
			throw error if error?
			@owner.createProject "example-project", {template: "example"}, (error, @project_id) =>
				throw error if error?
				done()

	describe "restoring a deleted doc", ->
		beforeEach (done) ->
			@owner.getProject @project_id, (error, project) =>
				throw error if error?
				@doc = _.find project.rootFolder[0].docs, (doc) ->
					doc.name == 'main.tex'
				@owner.request {
					method: "DELETE",
					url: "/project/#{@project_id}/doc/#{@doc._id}",
				}, (error, response, body) =>
					throw error if error?
					expect(response.statusCode).to.equal 204
					@owner.request {
						method: "POST",
						url: "/project/#{@project_id}/doc/#{@doc._id}/restore"
						json:
							name: "main.tex"
					}, (error, response, body) =>
						throw error if error?
						expect(response.statusCode).to.equal 200
						expect(body.doc_id).to.exist
						@restored_doc_id = body.doc_id
						done()

		it 'should have restored the doc', (done) ->
			@owner.getProject @project_id, (error, project) =>
				throw error if error?
				restored_doc = _.find project.rootFolder[0].docs, (doc) ->
					doc.name == 'main.tex'
				expect(restored_doc._id.toString()).to.equal @restored_doc_id
				expect(@doc._id).to.not.equal @restored_doc_id
				# console.log @doc_id, @restored_doc_id, MockDocstoreApi.docs[@project_id]
				expect(MockDocstoreApi.docs[@project_id][@restored_doc_id].lines).to.deep.equal(
					MockDocstoreApi.docs[@project_id][@doc._id].lines
				)
				done()

	describe "restoring from v2 history", ->
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
					expect(response.statusCode).to.equal 200
					done()

			it "should have created a doc", (done) ->
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
			beforeEach (done) ->
				@pngData = fs.readFileSync(Path.resolve(__dirname, '../files/1pixel.png'), 'binary')
				MockProjectHistoryApi.addOldFile(@project_id, 42, "image.png", @pngData)
				@owner.request {
					method: "POST",
					url: "/project/#{@project_id}/restore_file",
					json:
						pathname: "image.png"
						version: 42
				}, (error, response, body) ->
					throw error if error?
					expect(response.statusCode).to.equal 200
					done()

			it "should have created a file", (done) ->
				@owner.getProject @project_id, (error, project) =>
					throw error if error?
					file = _.find project.rootFolder[0].fileRefs, (file) ->
						file.name == 'image.png'
					file = MockFileStoreApi.files[@project_id][file._id]
					expect(file.content).to.equal @pngData
					done()

		describe "restoring to a directory that exists", ->
			beforeEach (done) ->
				MockProjectHistoryApi.addOldFile(@project_id, 42, "foldername/foo2.tex", "hello world, this is foo-2.tex!")
				@owner.request.post {
					uri: "project/#{@project_id}/folder",
					json:
						name: 'foldername'
				}, (error, response, body) =>
					throw error if error?
					expect(response.statusCode).to.equal 200
					@owner.request {
						method: "POST",
						url: "/project/#{@project_id}/restore_file",
						json:
							pathname: "foldername/foo2.tex"
							version: 42
					}, (error, response, body) ->
						throw error if error?
						expect(response.statusCode).to.equal 200
						done()

			it "should have created the doc in the named folder", (done) ->
				@owner.getProject @project_id, (error, project) =>
					throw error if error?
					folder = _.find project.rootFolder[0].folders, (folder) ->
						folder.name == 'foldername'
					doc = _.find folder.docs, (doc) ->
						doc.name == 'foo2.tex'
					doc = MockDocstoreApi.docs[@project_id][doc._id]
					expect(doc.lines).to.deep.equal [
						"hello world, this is foo-2.tex!"
					]
					done()

		describe "restoring to a directory that no longer exists", ->
			beforeEach (done) ->
				MockProjectHistoryApi.addOldFile(@project_id, 42, "nothere/foo3.tex", "hello world, this is foo-3.tex!")
				@owner.request {
					method: "POST",
					url: "/project/#{@project_id}/restore_file",
					json:
						pathname: "nothere/foo3.tex"
						version: 42
				}, (error, response, body) ->
					throw error if error?
					expect(response.statusCode).to.equal 200
					done()

			it "should have created the folder and restored the doc to it", (done) ->
				@owner.getProject @project_id, (error, project) =>
					throw error if error?
					folder = _.find project.rootFolder[0].folders, (folder) ->
						folder.name == 'nothere'
					expect(folder).to.exist
					doc = _.find folder.docs, (doc) ->
						doc.name == 'foo3.tex'
					doc = MockDocstoreApi.docs[@project_id][doc._id]
					expect(doc.lines).to.deep.equal [
						"hello world, this is foo-3.tex!"
					]
					done()

		describe "restoring to a filename that already exists", ->
			beforeEach (done) ->
				MockProjectHistoryApi.addOldFile(@project_id, 42, "main.tex", "hello world, this is main.tex!")
				@owner.request {
					method: "POST",
					url: "/project/#{@project_id}/restore_file",
					json:
						pathname: "main.tex"
						version: 42
				}, (error, response, body) ->
					throw error if error?
					expect(response.statusCode).to.equal 200
					done()

			it "should have created the doc in the root folder", (done) ->
				@owner.getProject @project_id, (error, project) =>
					throw error if error?
					doc = _.find project.rootFolder[0].docs, (doc) ->
						doc.name.match(/main \(Restored on/)
					expect(doc).to.exist
					doc = MockDocstoreApi.docs[@project_id][doc._id]
					expect(doc.lines).to.deep.equal [
						"hello world, this is main.tex!"
					]
					done()

