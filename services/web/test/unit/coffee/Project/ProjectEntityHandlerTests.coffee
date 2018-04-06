chai = require('chai')
assert = require('chai').assert
should = chai.should()
expect = chai.expect
sinon = require 'sinon'
modulePath = "../../../../app/js/Features/Project/ProjectEntityHandler"
SandboxedModule = require('sandboxed-module')
ObjectId = require("mongoose").Types.ObjectId
Errors = require "../../../../app/js/Features/Errors/Errors"

describe 'ProjectEntityHandler', ->
	project_id = '4eecb1c1bffa66588e0000a1'
	doc_id = '4eecb1c1bffa66588e0000a2'
	folder_id = "4eecaffcbffa66588e000008"
	rootFolderId = "4eecaffcbffa66588e000007"
	userId = 1234

	beforeEach ->
		@TpdsUpdateSender =
			addDoc:sinon.stub().callsArg(1)
			addFile:sinon.stub().callsArg(1)
		@ProjectModel = class Project
			constructor:(options)->
				@._id = project_id
				@name = "project_name_here"
				@rev = 0
			rootFolder:[@rootFolder]

		@project = new @ProjectModel()

		@ProjectLocator =
			findElement : sinon.stub()
		@DocumentUpdaterHandler =
			updateProjectStructure: sinon.stub().yields()

		@callback = sinon.stub()

		@ProjectEntityHandler = SandboxedModule.require modulePath, requires:
			'logger-sharelatex': @logger = {log:sinon.stub(), error: sinon.stub(), err:->}
			'../Docstore/DocstoreManager': @DocstoreManager = {}
			'../../Features/DocumentUpdater/DocumentUpdaterHandler':@DocumentUpdaterHandler
			'../../models/Project': Project:@ProjectModel
			'./ProjectLocator': @ProjectLocator
			"./ProjectGetter": @ProjectGetter = {}
			'../ThirdPartyDataStore/TpdsUpdateSender':@TpdsUpdateSender

	describe "getting folders, docs and files", ->
		beforeEach ->
			@project.rootFolder = [
				docs: [@doc1 = {
					name  : "doc1"
					_id   : "doc1_id"
				}]
				fileRefs: [@file1 = {
					rev  : 1
					_id  : "file1_id"
					name : "file1"
				}]
				folders: [@folder1 = {
					name    : "folder1"
					docs    : [@doc2 = {
						name  : "doc2"
						_id   : "doc2_id"
					}]
					fileRefs   : [@file2 = {
						rev  : 2
						name : "file2"
						_id  : "file2_id"
					}]
					folders : []
				}]
			]
			@ProjectGetter.getProjectWithoutDocLines = sinon.stub().yields(null, @project)

		describe "getAllDocs", ->
			beforeEach ->
				@docs = [{
					_id:   @doc1._id
					lines: @lines1 = ["one"]
					rev:   @rev1 = 1
				}, {
					_id:   @doc2._id
					lines: @lines2 = ["two"]
					rev:   @rev2 = 2
				}]
				@DocstoreManager.getAllDocs = sinon.stub().callsArgWith(1, null, @docs)
				@ProjectEntityHandler.getAllDocs project_id, @callback

			it "should get the doc lines and rev from the docstore", ->
				@DocstoreManager.getAllDocs
					.calledWith(project_id)
					.should.equal true

			it "should call the callback with the docs with the lines and rev included", ->
				@callback
					.calledWith(null, {
						"/doc1": {
							_id:   @doc1._id
							lines: @lines1
							name:  @doc1.name
							rev:   @rev1
						}
						"/folder1/doc2":  {
							_id:   @doc2._id
							lines: @lines2
							name:  @doc2.name
							rev:   @rev2
						}
					})
					.should.equal true

		describe "getAllFiles", ->
			beforeEach ->
				@callback = sinon.stub()
				@ProjectEntityHandler.getAllFiles project_id, @callback

			it "should call the callback with the files", ->
				@callback
					.calledWith(null, {
						"/file1": @file1
						"/folder1/file2": @file2
					})
					.should.equal true

		describe "getAllDocPathsFromProject", ->
			beforeEach ->
				@docs = [{
					_id:   @doc1._id
					lines: @lines1 = ["one"]
					rev:   @rev1 = 1
				}, {
					_id:   @doc2._id
					lines: @lines2 = ["two"]
					rev:   @rev2 = 2
				}]
				@callback = sinon.stub()
				@ProjectEntityHandler.getAllDocPathsFromProject @project, @callback

			it "should call the callback with the path for each doc_id", ->
				@expected = {}
				@expected[@doc1._id] = "/#{@doc1.name}"
				@expected[@doc2._id] = "/folder1/#{@doc2.name}"
				@callback
					.calledWith(null, @expected)
					.should.equal true

		describe "_getAllFolders", ->
			beforeEach ->
				@callback = sinon.stub()
				@ProjectEntityHandler._getAllFolders project_id, @callback

			it "should get the project without the docs lines", ->
				@ProjectGetter.getProjectWithoutDocLines
					.calledWith(project_id)
					.should.equal true

			it "should call the callback with the folders", ->
				@callback
					.calledWith(null, {
						"/": @project.rootFolder[0]
						"/folder1": @folder1
					})
					.should.equal true

		describe "_getAllFoldersFromProject", ->
			beforeEach ->
				@callback = sinon.stub()
				@ProjectEntityHandler._getAllFoldersFromProject @project, @callback

			it "should call the callback with the folders", ->
				@callback
					.calledWith(null, {
						"/": @project.rootFolder[0]
						"/folder1": @folder1
					})
					.should.equal true

	describe "flushProjectToThirdPartyDataStore", ->
		beforeEach (done) ->
			@project = {
				_id: project_id
				name: "Mock project name"
			}
			@DocumentUpdaterHandler.flushProjectToMongo = sinon.stub().yields()
			@docs = {
				"/doc/one": @doc1 = { _id: "mock-doc-1", lines: ["one"], rev: 5 }
				"/doc/two": @doc2 = { _id: "mock-doc-2", lines: ["two"], rev: 6 }
			}
			@files = {
				"/file/one": @file1 = { _id: "mock-file-1", rev: 7 }
				"/file/two": @file2 = { _id: "mock-file-2", rev: 8 }
			}
			@ProjectEntityHandler.getAllDocs = sinon.stub().yields(null, @docs)
			@ProjectEntityHandler.getAllFiles = sinon.stub().yields(null, @files)

			@ProjectGetter.getProject = sinon.stub().yields(null, @project)

			@ProjectEntityHandler.flushProjectToThirdPartyDataStore project_id, () -> done()

		it "should flush the project from the doc updater", ->
			@DocumentUpdaterHandler.flushProjectToMongo.calledWith(project_id).should.equal true

		it "should look up the project in mongo", ->
			@ProjectGetter.getProject.calledWith(project_id).should.equal true

		it "should get all the docs in the project", ->
			@ProjectEntityHandler.getAllDocs.calledWith(project_id).should.equal true

		it "should get all the files in the project", ->
			@ProjectEntityHandler.getAllFiles.calledWith(project_id).should.equal true

		it "should flush each doc to the TPDS", ->
			for path, doc of @docs
				@TpdsUpdateSender.addDoc
					.calledWith({
						project_id: project_id,
						doc_id: doc._id
						project_name: @project.name
						rev: doc.rev
						path: path
					})
					.should.equal true

		it "should flush each file to the TPDS", ->
			for path, file of @files
				@TpdsUpdateSender.addFile
					.calledWith({
						project_id: project_id,
						file_id: file._id
						project_name: @project.name
						rev: file.rev
						path: path
					})
					.should.equal true

	describe 'getDoc', ->
		beforeEach ->
			@lines = ["mock", "doc", "lines"]
			@rev = 5
			@version = 42
			@ranges = {"mock": "ranges"}

			@DocstoreManager.getDoc = sinon.stub().callsArgWith(3, null, @lines, @rev, @version, @ranges)
			@ProjectEntityHandler.getDoc project_id, doc_id, @callback

		it "should call the docstore", ->
			@DocstoreManager.getDoc
				.calledWith(project_id, doc_id)
				.should.equal true

		it "should call the callback with the lines, version and rev", ->
			@callback.calledWith(null, @lines, @rev, @version, @ranges).should.equal true
