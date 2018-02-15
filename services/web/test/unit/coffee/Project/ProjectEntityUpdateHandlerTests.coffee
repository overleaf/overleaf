chai = require('chai')
assert = require('chai').assert
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Project/ProjectEntityUpdateHandler"
sinon = require 'sinon'
Errors = require "../../../../app/js/Features/Errors/Errors"
SandboxedModule = require('sandboxed-module')
ObjectId = require("mongoose").Types.ObjectId

describe 'ProjectEntityUpdateHandler', ->
	project_id = '4eecb1c1bffa66588e0000a1'
	doc_id = '4eecb1c1bffa66588e0000a2'
	file_id = "4eecaffcbffa66588e000009"
	folder_id = "4eecaffcbffa66588e000008"
	rootFolderId = "4eecaffcbffa66588e000007"
	userId = 1234

	beforeEach ->
		@project = _id: project_id, name: 'project name'
		@fileUrl = 'filestore.example.com/file'
		@FileStoreHandler =
			uploadFileFromDisk: sinon.stub().yields(null, @fileUrl)
			copyFile: sinon.stub().yields(null, @fileUrl)

		@DocModel = class Doc
			constructor:(options)->
				{@name, @lines} = options
				@_id = doc_id
				@rev = 0
		@FileModel = class File
			constructor:(options)->
				{@name} = options
				@._id = file_id
				@rev = 0

		@docName = "doc-name"
		@docLines = ['1234','abc']

		@fileName = "something.jpg"
		@fileSystemPath = "somehintg"

		@source = 'editor'
		@callback = sinon.stub()
		@ProjectEntityUpdateHandler = SandboxedModule.require modulePath, requires:
			'logger-sharelatex': @logger = {log:sinon.stub(), error: sinon.stub(), err:->}
			'../../models/Doc': Doc:@DocModel
			'../Docstore/DocstoreManager': @DocstoreManager = {}
			'../Errors/Errors': Errors
			'../../Features/DocumentUpdater/DocumentUpdaterHandler':@DocumentUpdaterHandler =
				updateProjectStructure: sinon.stub().yields()
			'../../models/File': File:@FileModel
			'../FileStore/FileStoreHandler':@FileStoreHandler
			"../../infrastructure/LockManager":@LockManager =
				runWithLock:
					sinon.spy((key, runner, callback) -> runner(callback))
			'../../models/Project': Project:@ProjectModel = {}
			"./ProjectGetter": @ProjectGetter = {}
			'./ProjectLocator': @ProjectLocator = {}
			'./ProjectUpdateHandler': @ProjectUpdater = {}
			'./ProjectEntityHandler': @ProjectEntityHandler = {}
			'./ProjectEntityMongoUpdateHandler': @ProjectEntityMongoUpdateHandler = {}
			'../ThirdPartyDataStore/TpdsUpdateSender':@TpdsUpdateSender =
				addFile: sinon.stub().yields()

	describe 'copyFileFromExistingProjectWithProject', ->

		beforeEach ->
			@oldProject_id = "123kljadas"
			@oldFileRef = {name:@fileName, _id:"oldFileRef"}
			@ProjectEntityMongoUpdateHandler._confirmFolder = sinon.stub().yields(folder_id)
			@ProjectEntityMongoUpdateHandler._putElement = sinon.stub().yields(null, {path:{fileSystem: @fileSystemPath}})

			@ProjectEntityUpdateHandler.copyFileFromExistingProjectWithProject @project, folder_id, @oldProject_id, @oldFileRef, userId, @callback

		it 'should copy the file in FileStoreHandler', ->
			@FileStoreHandler.copyFile
				.calledWith(@oldProject_id, @oldFileRef._id, project_id, file_id)
				.should.equal true

		it 'should put file into folder by calling put element', ->
			@ProjectEntityMongoUpdateHandler._putElement
				.calledWithMatch(@project, folder_id, { _id: file_id, name: @fileName }, "file")
				.should.equal true

		it 'should return doc and parent folder', ->
			@callback.calledWithMatch(null,{ _id: file_id, name: @fileName }, folder_id).should.equal true

		it 'should call third party data store if versioning is enabled', ->
			@TpdsUpdateSender.addFile.calledWith(
				project_id: project_id
				file_id: file_id
				path: @fileSystemPath
				rev: 0
				project_name: @project.name
			).should.equal true

		it "should should send the change in project structure to the doc updater",  ->
			changesMatcher = sinon.match (changes) =>
				{ newFiles } = changes
				return false if newFiles.length != 1
				newFile = newFiles[0]
				newFile.file._id == file_id &&
				newFile.path == @fileSystemPath &&
				newFile.url == @fileUrl

			@DocumentUpdaterHandler.updateProjectStructure
				.calledWithMatch(project_id, userId, changesMatcher)
				.should.equal true

	describe 'updateDocLines', ->
		beforeEach ->
			@path = "/somewhere/something.tex"
			@doc = {
				_id: doc_id
			}
			@version = 42
			@ranges = {"mock":"ranges"}
			@ProjectGetter.getProjectWithoutDocLines = sinon.stub().yields(null, @project)
			@ProjectLocator.findElement = sinon.stub().yields(null, @doc, {fileSystem: @path})
			@TpdsUpdateSender.addDoc = sinon.stub().yields()
			@ProjectUpdater.markAsUpdated = sinon.stub()
			@callback = sinon.stub()

		describe "when the doc has been modified", ->
			beforeEach ->
				@DocstoreManager.updateDoc = sinon.stub().yields(null, true, @rev = 5)
				@ProjectEntityUpdateHandler.updateDocLines project_id, doc_id, @docLines, @version, @ranges, @callback

			it "should get the project without doc lines", ->
				@ProjectGetter.getProjectWithoutDocLines
					.calledWith(project_id)
					.should.equal true

			it "should find the doc", ->
				@ProjectLocator.findElement
					.calledWith({
						project: @project
						type: "docs"
						element_id: doc_id
					})
					.should.equal true

			it "should update the doc in the docstore", ->
				@DocstoreManager.updateDoc
					.calledWith(project_id, doc_id, @docLines, @version, @ranges)
					.should.equal true

			it "should mark the project as updated", ->
				@ProjectUpdater.markAsUpdated
					.calledWith(project_id)
					.should.equal true

			it "should send the doc the to the TPDS", ->
				@TpdsUpdateSender.addDoc
					.calledWith({
						project_id: project_id
						project_name: @project.name
						doc_id: doc_id
						rev: @rev
						path: @path
					})
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when the doc has not been modified", ->
			beforeEach ->
				@DocstoreManager.updateDoc = sinon.stub().yields(null, false, @rev = 5)
				@ProjectEntityUpdateHandler.updateDocLines project_id, doc_id, @docLines, @version, @ranges, @callback

			it "should not mark the project as updated", ->
				@ProjectUpdater.markAsUpdated.called.should.equal false

			it "should not send the doc the to the TPDS", ->
				@TpdsUpdateSender.addDoc.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when the doc has been deleted", ->
			beforeEach ->
				@project.deletedDocs = [ _id: doc_id ]
				@ProjectGetter.getProjectWithoutDocLines = sinon.stub().yields(null, @project)
				@ProjectLocator.findElement = sinon.stub().yields(new Errors.NotFoundError)
				@DocstoreManager.updateDoc = sinon.stub().yields()
				@ProjectEntityUpdateHandler.updateDocLines project_id, doc_id, @docLines, @version, @ranges, @callback

			it "should update the doc in the docstore", ->
				@DocstoreManager.updateDoc
					.calledWith(project_id, doc_id, @docLines, @version, @ranges)
					.should.equal true

			it "should not mark the project as updated", ->
				@ProjectUpdater.markAsUpdated.called.should.equal false

			it "should not send the doc the to the TPDS", ->
				@TpdsUpdateSender.addDoc.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when the doc is not related to the project", ->
			beforeEach ->
				@ProjectLocator.findElement = sinon.stub().yields()
				@ProjectEntityUpdateHandler.updateDocLines project_id, doc_id, @docLines, @version, @ranges, @callback

			it "should log out the error", ->
				@logger.error
					.calledWith(
						project_id: project_id
						doc_id: doc_id
						lines: @docLines
						"doc not found while updating doc lines"
					)
					.should.equal true

			it "should return a not found error", ->
				@callback.calledWith(new Errors.NotFoundError()).should.equal true

		describe "when the project is not found", ->
			beforeEach ->
				@ProjectGetter.getProjectWithoutDocLines = sinon.stub().yields()
				@ProjectEntityUpdateHandler.updateDocLines project_id, doc_id, @docLines, @version, @ranges, @callback

			it "should return a not found error", ->
				@callback.calledWith(new Errors.NotFoundError()).should.equal true

	describe "setRootDoc", ->
		it "should call Project.update", ->
			rootDoc_id = "root-doc-id-123123"
			@ProjectModel.update = sinon.stub()
			@ProjectEntityUpdateHandler.setRootDoc project_id, rootDoc_id
			@ProjectModel.update
				.calledWith({_id : project_id}, {rootDoc_id})
				.should.equal true

	describe "unsetRootDoc", ->
		it "should call Project.update", ->
			@ProjectModel.update = sinon.stub()
			@ProjectEntityUpdateHandler.unsetRootDoc project_id
			@ProjectModel.update
				.calledWith({_id : project_id}, {$unset : {rootDoc_id: true}})
				.should.equal true

	describe "restoreDoc", ->
		beforeEach ->
			@doc = { "mock": "doc" }
			@ProjectEntityHandler.getDoc = sinon.stub().yields(null, @docLines)
			@ProjectEntityUpdateHandler.addDoc = sinon.stub().yields(null, @doc, folder_id)

			@ProjectEntityUpdateHandler.restoreDoc project_id, doc_id, @docName, @callback

		it 'should get the doc lines', ->
			@ProjectEntityHandler.getDoc
				.calledWith(project_id, doc_id, include_deleted: true)
				.should.equal true

		it "should add a new doc with these doc lines", ->
			@ProjectEntityUpdateHandler.addDoc
				.calledWith(project_id, null, @docName, @docLines)
				.should.equal true

		it "should call the callback with the new folder and doc", ->
			@callback.calledWith(null, @doc, folder_id).should.equal true

	describe 'addDoc', ->
		beforeEach ->
			@path = "/path/to/doc"

			@newDoc = _id: doc_id
			@ProjectEntityUpdateHandler.addDocWithoutUpdatingHistory =
				withoutLock: sinon.stub().yields(null, @newDoc, folder_id, @path)
			@ProjectEntityUpdateHandler.addDoc project_id, folder_id, @docName, @docLines, userId, @callback

		it "creates the doc without history", () ->
			@ProjectEntityUpdateHandler.addDocWithoutUpdatingHistory.withoutLock
				.calledWith(project_id, folder_id, @docName, @docLines, userId)
				.should.equal true

		it "sends the change in project structure to the doc updater", () ->
			newDocs = [
				doc: @newDoc
				path: @path
				docLines: @docLines.join('\n')
			]
			@DocumentUpdaterHandler.updateProjectStructure
				.calledWith(project_id, userId, {newDocs})
				.should.equal true

	describe 'addFile', ->
		beforeEach ->
			@path = "/path/to/file"

			@newFile = _id: file_id
			@ProjectEntityUpdateHandler.addFileWithoutUpdatingHistory =
				withoutLock: sinon.stub().yields(null, @newFile, folder_id, @path, @fileUrl)
			@ProjectEntityUpdateHandler.addFile project_id, folder_id, @docName, @fileSystemPath, userId, @callback

		it "creates the doc without history", () ->
			@ProjectEntityUpdateHandler.addFileWithoutUpdatingHistory.withoutLock
				.calledWith(project_id, folder_id, @docName, @fileSystemPath, userId)
				.should.equal true

		it "sends the change in project structure to the doc updater", () ->
			newFiles = [
				file: @newFile
				path: @path
				url: @fileUrl
			]
			@DocumentUpdaterHandler.updateProjectStructure
				.calledWith(project_id, userId, {newFiles})
				.should.equal true

	describe 'replaceFile', ->
		beforeEach ->
			@newFile = _id: file_id, rev: 0
			@path = "/path/to/file"
			@project = _id: project_id, name: 'some project'
			@ProjectEntityMongoUpdateHandler.replaceFile = sinon.stub().yields(null, @newFile, @project, fileSystem: @path)

			@ProjectEntityUpdateHandler.replaceFile project_id, file_id, @fileSystemPath, userId, @callback

		it 'uploads a new version of the file', ->
			@FileStoreHandler.uploadFileFromDisk
				.calledWith(project_id, file_id, @fileSystemPath)
				.should.equal true

		it 'replaces the file in mongo', ->
			@ProjectEntityMongoUpdateHandler.replaceFile
				.calledWith(project_id, file_id)
				.should.equal true

		it 'notifies the tpds', ->
			@TpdsUpdateSender.addFile
				.calledWith({
					project_id: project_id
					project_name: @project.name
					file_id: file_id
					rev: @newFile.rev + 1
					path: @path
				})
				.should.equal true

		it 'updates the project structure in the doc updater', ->
			newFiles = [
				file: @newFile
				path: @path
				url: @fileUrl
			]
			@DocumentUpdaterHandler.updateProjectStructure
				.calledWith(project_id, userId, {newFiles})
				.should.equal true

	describe 'addDocWithoutUpdatingHistory', ->
		beforeEach ->
			@path = "/path/to/doc"

			@project = _id: project_id, name: 'some project'

			@TpdsUpdateSender.addDoc = sinon.stub().yields()
			@DocstoreManager.updateDoc = sinon.stub().yields(null, false, @rev = 5)
			@ProjectEntityMongoUpdateHandler.addDoc = sinon.stub().yields(null, {path: fileSystem: @path}, @project)
			@ProjectEntityUpdateHandler.addDocWithoutUpdatingHistory project_id, folder_id, @docName, @docLines, userId, @callback

		it "updates the doc in the docstore", () ->
			@DocstoreManager.updateDoc
				.calledWith(project_id, doc_id, @docLines, 0, {})
				.should.equal true

		it "updates the doc in mongo", () ->
			docMatcher = sinon.match (doc) =>
				doc.name == @docName

			@ProjectEntityMongoUpdateHandler.addDoc
				.calledWithMatch(project_id, folder_id, docMatcher)
				.should.equal true

		it "notifies the tpds", () ->
			@TpdsUpdateSender.addDoc
				.calledWith({
					project_id: project_id
					project_name: @project.name
					doc_id: doc_id
					rev: 0
					path: @path
				})
				.should.equal true

		it "should not should send the change in project structure to the doc updater", () ->
			@DocumentUpdaterHandler.updateProjectStructure
				.called
				.should.equal false

	describe 'addFileWithoutUpdatingHistory', ->
		beforeEach ->
			@path = "/path/to/file"

			@project = _id: project_id, name: 'some project'

			@TpdsUpdateSender.addFile = sinon.stub().yields()
			@ProjectEntityMongoUpdateHandler.addFile = sinon.stub().yields(null, {path: fileSystem: @path}, @project)
			@ProjectEntityUpdateHandler.addFileWithoutUpdatingHistory project_id, folder_id, @fileName, @fileSystemPath, userId, @callback

		it "updates the file in the filestore", () ->
			@FileStoreHandler.uploadFileFromDisk
				.calledWith(project_id, file_id, @fileSystemPath)
				.should.equal true

		it "updates the file in mongo", () ->
			fileMatcher = sinon.match (file) =>
				file.name == @fileName

			@ProjectEntityMongoUpdateHandler.addFile
				.calledWithMatch(project_id, folder_id, fileMatcher)
				.should.equal true

		it "notifies the tpds", () ->
			@TpdsUpdateSender.addFile
				.calledWith({
					project_id: project_id
					project_name: @project.name
					file_id: file_id
					rev: 0
					path: @path
				})
				.should.equal true

		it "should not should send the change in project structure to the doc updater", () ->
			@DocumentUpdaterHandler.updateProjectStructure
				.called
				.should.equal false

	describe 'upsertDoc', ->
		describe 'upserting into an invalid folder', ->
			beforeEach ->
				@ProjectLocator.findElement = sinon.stub().yields()
				@ProjectEntityUpdateHandler.upsertDoc project_id, folder_id, @docName, @docLines, @source, userId, @callback

			it 'returns an error', ->
				errorMatcher = sinon.match.instanceOf(Error)
				@callback.calledWithMatch(errorMatcher)
					.should.equal true

		describe 'updating an existing doc', ->
			beforeEach ->
				@existingDoc = _id: doc_id, name: @docName
				@folder = _id: folder_id, docs: [@existingDoc]
				@ProjectLocator.findElement = sinon.stub().yields(null, @folder)
				@DocumentUpdaterHandler.setDocument = sinon.stub().yields()
				@DocumentUpdaterHandler.flushDocToMongo = sinon.stub().yields()

				@ProjectEntityUpdateHandler.upsertDoc project_id, folder_id, @docName, @docLines, @source, userId, @callback

			it 'tries to find the folder', ->
				@ProjectLocator.findElement
					.calledWith({project_id, element_id: folder_id, type: "folder"})
					.should.equal true

			it 'updates the doc contents', ->
				@DocumentUpdaterHandler.setDocument
					.calledWith(project_id, @existingDoc._id, userId, @docLines, @source)
					.should.equal true

			it 'flushes the doc contents', ->
				@DocumentUpdaterHandler.flushDocToMongo
					.calledWith(project_id, @existingDoc._id )
					.should.equal true

			it 'returns the doc', ->
				@callback.calledWith(null, @existingDoc, false)

		describe 'creating a new doc', ->
			beforeEach ->
				@folder = _id: folder_id, docs: []
				@newDoc = _id: doc_id
				@ProjectLocator.findElement = sinon.stub().yields(null, @folder)
				@ProjectEntityUpdateHandler.addDoc = withoutLock: sinon.stub().yields(null, @newDoc)

				@ProjectEntityUpdateHandler.upsertDoc project_id, folder_id, @docName, @docLines, @source, userId, @callback

			it 'tries to find the folder', ->
				@ProjectLocator.findElement
					.calledWith({project_id, element_id: folder_id, type: "folder"})
					.should.equal true

			it 'adds the doc', ->
				@ProjectEntityUpdateHandler.addDoc.withoutLock
					.calledWith(project_id, folder_id, @docName, @docLines, userId)
					.should.equal true

			it 'returns the doc', ->
				@callback.calledWith(null, @newDoc, true)

	describe 'upsertFile', ->
		describe 'upserting into an invalid folder', ->
			beforeEach ->
				@ProjectLocator.findElement = sinon.stub().yields()
				@ProjectEntityUpdateHandler.upsertFile project_id, folder_id, @fileName, @fileSystemPath, userId, @callback

			it 'returns an error', ->
				errorMatcher = sinon.match.instanceOf(Error)
				@callback.calledWithMatch(errorMatcher)
					.should.equal true

		describe 'updating an existing file', ->
			beforeEach ->
				@existingFile = _id: file_id, name: @fileName
				@folder = _id: folder_id, fileRefs: [@existingFile]
				@ProjectLocator.findElement = sinon.stub().yields(null, @folder)
				@ProjectEntityUpdateHandler.replaceFile = withoutLock: sinon.stub().yields(null, @newFile)

				@ProjectEntityUpdateHandler.upsertFile project_id, folder_id, @fileName, @fileSystemPath, userId, @callback

			it 'replaces the file', ->
				@ProjectEntityUpdateHandler.replaceFile.withoutLock
					.calledWith(project_id, file_id, @fileSystemPath, userId)
					.should.equal true

			it 'returns the file', ->
				@callback.calledWith(null, @existingFile, false)

		describe 'creating a new file', ->
			beforeEach ->
				@folder = _id: folder_id, fileRefs: []
				@newFile = _id: file_id
				@ProjectLocator.findElement = sinon.stub().yields(null, @folder)
				@ProjectEntityUpdateHandler.addFile = withoutLock: sinon.stub().yields(null, @newFile)

				@ProjectEntityUpdateHandler.upsertFile project_id, folder_id, @fileName, @fileSystemPath, userId, @callback

			it 'tries to find the folder', ->
				@ProjectLocator.findElement
					.calledWith({project_id, element_id: folder_id, type: "folder"})
					.should.equal true

			it 'adds the file', ->
				@ProjectEntityUpdateHandler.addFile.withoutLock
					.calledWith(project_id, folder_id, @fileName, @fileSystemPath, userId)
					.should.equal true

			it 'returns the file', ->
				@callback.calledWith(null, @newFile, true)

	describe 'upsertDocWithPath', ->
		beforeEach ->
			@path = "/folder/doc.tex"
			@newFolders = [ 'mock-a', 'mock-b' ]
			@folder = _id: folder_id
			@doc = _id: doc_id
			@isNewDoc = true
			@ProjectEntityUpdateHandler.mkdirp =
				withoutLock: sinon.stub().yields(null, @newFolders, @folder)
			@ProjectEntityUpdateHandler.upsertDoc =
				withoutLock: sinon.stub().yields(null, @doc, @isNewDoc)

			@ProjectEntityUpdateHandler.upsertDocWithPath project_id, @path, @docLines, @source, userId, @callback

		it 'creates any necessary folders', ->
			@ProjectEntityUpdateHandler.mkdirp.withoutLock
				.calledWith(project_id, '/folder')
				.should.equal true

		it 'upserts the doc', ->
			@ProjectEntityUpdateHandler.upsertDoc.withoutLock
				.calledWith(project_id, @folder._id, 'doc.tex', @docLines, @source, userId)
				.should.equal true

		it 'calls the callback', ->
			@callback
				.calledWith(null, @doc, @isNewDoc, @newFolders, @folder)
				.should.equal true

	describe 'upsertFileWithPath', ->
		beforeEach ->
			@path = "/folder/file.png"
			@newFolders = [ 'mock-a', 'mock-b' ]
			@folder = _id: folder_id
			@file = _id: file_id
			@isNewFile = true
			@ProjectEntityUpdateHandler.mkdirp =
				withoutLock: sinon.stub().yields(null, @newFolders, @folder)
			@ProjectEntityUpdateHandler.upsertFile =
				withoutLock: sinon.stub().yields(null, @file, @isNewFile)

			@ProjectEntityUpdateHandler.upsertFileWithPath project_id, @path, @fileSystemPath, userId, @callback

		it 'creates any necessary folders', ->
			@ProjectEntityUpdateHandler.mkdirp.withoutLock
				.calledWith(project_id, '/folder')
				.should.equal true

		it 'upserts the file', ->
			@ProjectEntityUpdateHandler.upsertFile.withoutLock
				.calledWith(project_id, @folder._id, 'file.png', @fileSystemPath, userId)
				.should.equal true

		it 'calls the callback', ->
			@callback
				.calledWith(null, @file, @isNewFile, @newFolders, @folder)
				.should.equal true

	describe 'deleteEntity', ->
		beforeEach ->
			@path = '/path/to/doc.tex'
			@doc = _id: doc_id
			@projectBeforeDeletion = _id: project_id, name: 'project'
			@ProjectEntityMongoUpdateHandler.deleteEntity = sinon.stub().yields(null, @doc, {fileSystem: @path}, @projectBeforeDeletion)
			@ProjectEntityUpdateHandler._cleanUpEntity = sinon.stub().yields()
			@TpdsUpdateSender.deleteEntity = sinon.stub().yields()

			@ProjectEntityUpdateHandler.deleteEntity project_id, doc_id, 'doc', userId, @callback

		it 'deletes the entity in mongo', ->
			@ProjectEntityMongoUpdateHandler.deleteEntity
				.calledWith(project_id, doc_id, 'doc')
				.should.equal true

		it 'cleans up the doc in the docstore', ->
			@ProjectEntityUpdateHandler._cleanUpEntity
				.calledWith(@projectBeforeDeletion, @doc, 'doc', @path, userId)
				.should.equal true

		it 'it notifies the tpds', ->
			@TpdsUpdateSender.deleteEntity
				.calledWith({ project_id, @path, project_name: @projectBeforeDeletion.name })
				.should.equal true

		it 'retuns the entity_id', ->
			@callback.calledWith(null, doc_id).should.equal true

	describe 'deleteEntityWithPath', ->
		describe 'when the entity exists', ->
			beforeEach ->
				@doc = _id: doc_id
				@ProjectLocator.findElementByPath = sinon.stub().yields(null, @doc, 'doc')
				@ProjectEntityUpdateHandler.deleteEntity =
					withoutLock: sinon.stub().yields()
				@path = '/path/to/doc.tex'
				@ProjectEntityUpdateHandler.deleteEntityWithPath project_id, @path, userId, @callback

			it 'finds the entity', ->
				@ProjectLocator.findElementByPath
					.calledWith({project_id, @path})
					.should.equal true

			it 'deletes the entity', ->
				@ProjectEntityUpdateHandler.deleteEntity.withoutLock
					.calledWith(project_id, @doc._id, 'doc', userId, @callback)
					.should.equal true

		describe 'when the entity does not exist', ->
			beforeEach ->
				@ProjectLocator.findElementByPath = sinon.stub().yields()
				@path = '/doc.tex'
				@ProjectEntityUpdateHandler.deleteEntityWithPath project_id, @path, userId, @callback

			it 'returns an error', ->
				@callback.calledWith(new Errors.NotFoundError()).should.equal true

	describe 'mkdirp', ->
		beforeEach ->
			@docPath = '/folder/doc.tex'
			@ProjectEntityMongoUpdateHandler.mkdirp = sinon.stub().yields()
			@ProjectEntityUpdateHandler.mkdirp project_id, @docPath, @callback

		it 'calls ProjectEntityMongoUpdateHandler', ->
			@ProjectEntityMongoUpdateHandler.mkdirp
				.calledWith(project_id, @docPath)
				.should.equal true

	describe 'addFolder', ->
		beforeEach ->
			@parentFolder_id = '123asdf'
			@folderName = 'new-folder'
			@ProjectEntityMongoUpdateHandler.addFolder = sinon.stub().yields()
			@ProjectEntityUpdateHandler.addFolder project_id, @parentFolder_id, @folderName, @callback

		it 'calls ProjectEntityMongoUpdateHandler', ->
			@ProjectEntityMongoUpdateHandler.addFolder
				.calledWith(project_id, @parentFolder_id, @folderName)
				.should.equal true

	describe 'moveEntity', ->
		beforeEach ->
			@project_name = 'project name'
			@startPath = '/a.tex'
			@endPath = '/folder/b.tex'
			@rev = 2
			@changes = newDocs: ['old-doc'], newFiles: ['old-file']
			@ProjectEntityMongoUpdateHandler.moveEntity = sinon.stub().yields(
				null, @project_name, @startPath, @endPath, @rev, @changes
			)
			@TpdsUpdateSender.moveEntity = sinon.stub()
			@DocumentUpdaterHandler.updateProjectStructure = sinon.stub()

			@ProjectEntityUpdateHandler.moveEntity project_id, doc_id, folder_id, 'doc', userId, @callback

		it 'moves the entity in mongo', ->
			@ProjectEntityMongoUpdateHandler.moveEntity
				.calledWith(project_id, doc_id, folder_id, 'doc')
				.should.equal true

		it 'notifies tpds', ->
			@TpdsUpdateSender.moveEntity
				.calledWith({project_id, @project_name, @startPath, @endPath, @rev})
				.should.equal true

		it 'sends the changes in project structure to the doc updater',  ->
			@DocumentUpdaterHandler.updateProjectStructure
				.calledWith(project_id, userId, @changes, @callback)
				.should.equal true

	describe "renameEntity", ->
		beforeEach ->
			@project_name = 'project name'
			@startPath = '/folder/a.tex'
			@endPath = '/folder/b.tex'
			@rev = 2
			@changes = newDocs: ['old-doc'], newFiles: ['old-file']
			@newDocName = 'b.tex'
			@ProjectEntityMongoUpdateHandler.renameEntity = sinon.stub().yields(
				null, @project_name, @startPath, @endPath, @rev, @changes
			)
			@TpdsUpdateSender.moveEntity = sinon.stub()
			@DocumentUpdaterHandler.updateProjectStructure = sinon.stub()

			@ProjectEntityUpdateHandler.renameEntity project_id, doc_id, 'doc', @newDocName, userId, @callback

		it 'moves the entity in mongo', ->
			@ProjectEntityMongoUpdateHandler.renameEntity
				.calledWith(project_id, doc_id, 'doc', @newDocName)
				.should.equal true

		it 'notifies tpds', ->
			@TpdsUpdateSender.moveEntity
				.calledWith({project_id, @project_name, @startPath, @endPath, @rev})
				.should.equal true

		it 'sends the changes in project structure to the doc updater',  ->
			@DocumentUpdaterHandler.updateProjectStructure
				.calledWith(project_id, userId, @changes, @callback)
				.should.equal true

	describe "_cleanUpEntity", ->
		beforeEach ->
			@entity_id = "4eecaffcbffa66588e000009"
			@FileStoreHandler.deleteFile = sinon.stub().yields()
			@DocumentUpdaterHandler.deleteDoc = sinon.stub().yields()
			@ProjectEntityUpdateHandler.unsetRootDoc = sinon.stub().yields()

		describe "a file", ->
			beforeEach (done) ->
				@path = "/file/system/path.png"
				@entity = _id: @entity_id
				@ProjectEntityUpdateHandler._cleanUpEntity @project, @entity, 'file', @path, userId, done

			it "should delete the file from FileStoreHandler", ->
				@FileStoreHandler.deleteFile.calledWith(project_id, @entity_id).should.equal true

			it "should not attempt to delete from the document updater", ->
				@DocumentUpdaterHandler.deleteDoc.called.should.equal false

			it "should should send the update to the doc updater", ->
				oldFiles = [ file: @entity, path: @path ]
				@DocumentUpdaterHandler.updateProjectStructure
					.calledWith(project_id, userId, {oldFiles})
					.should.equal true

		describe "a doc", ->
			beforeEach (done) ->
				@path = "/file/system/path.tex"
				@ProjectEntityUpdateHandler._cleanUpDoc = sinon.stub().yields()
				@entity = {_id: @entity_id}
				@ProjectEntityUpdateHandler._cleanUpEntity @project, @entity, 'doc', @path, userId, done

			it "should clean up the doc", ->
				@ProjectEntityUpdateHandler._cleanUpDoc
					.calledWith(@project, @entity, @path, userId)
					.should.equal true

		describe "a folder", ->
			beforeEach (done) ->
				@folder =
					folders: [
						name: "subfolder"
						fileRefs: [ @file1 = { _id: "file-id-1", name: "file-name-1"} ]
						docs:     [ @doc1  = { _id: "doc-id-1", name: "doc-name-1" } ]
						folders:  []
					]
					fileRefs: [ @file2 = { _id: "file-id-2", name: "file-name-2" } ]
					docs:     [ @doc2  = { _id: "doc-id-2", name: "doc-name-2" } ]

				@ProjectEntityUpdateHandler._cleanUpDoc = sinon.stub().yields()
				@ProjectEntityUpdateHandler._cleanUpFile = sinon.stub().yields()
				path = "/folder"
				@ProjectEntityUpdateHandler._cleanUpEntity @project, @folder, "folder", path, userId, done

			it "should clean up all sub files", ->
				@ProjectEntityUpdateHandler._cleanUpFile
					.calledWith(@project, @file1, "/folder/subfolder/file-name-1", userId)
					.should.equal true
				@ProjectEntityUpdateHandler._cleanUpFile
					.calledWith(@project, @file2, "/folder/file-name-2", userId)
					.should.equal true

			it "should clean up all sub docs", ->
				@ProjectEntityUpdateHandler._cleanUpDoc
					.calledWith(@project, @doc1, "/folder/subfolder/doc-name-1", userId)
					.should.equal true
				@ProjectEntityUpdateHandler._cleanUpDoc
					.calledWith(@project, @doc2, "/folder/doc-name-2", userId)
					.should.equal true

	describe "_cleanUpDoc", ->
		beforeEach ->
			@project =
				_id: ObjectId(project_id)
			@doc =
				_id: ObjectId()
				name: "test.tex"
			@path = "/path/to/doc"
			@ProjectEntityUpdateHandler.unsetRootDoc = sinon.stub().yields()
			@ProjectEntityUpdateHandler._insertDeletedDocReference = sinon.stub().yields()
			@DocumentUpdaterHandler.deleteDoc = sinon.stub().yields()
			@DocstoreManager.deleteDoc = sinon.stub().yields()
			@callback = sinon.stub()

		describe "when the doc is the root doc", ->
			beforeEach ->
				@project.rootDoc_id = @doc._id
				@ProjectEntityUpdateHandler._cleanUpDoc @project, @doc, @path, userId, @callback

			it "should unset the root doc", ->
				@ProjectEntityUpdateHandler.unsetRootDoc
					.calledWith(project_id)
					.should.equal true

			it "should delete the doc in the doc updater", ->
				@DocumentUpdaterHandler.deleteDoc
					.calledWith(project_id, @doc._id.toString())

			it "should insert the doc into the deletedDocs array", ->
				@ProjectEntityUpdateHandler._insertDeletedDocReference
					.calledWith(@project._id, @doc)
					.should.equal true

			it "should delete the doc in the doc store", ->
				@DocstoreManager.deleteDoc
					.calledWith(project_id, @doc._id.toString())
					.should.equal true

			it "should should send the update to the doc updater", ->
				oldDocs = [ doc: @doc, path: @path ]
				@DocumentUpdaterHandler.updateProjectStructure
					.calledWith(project_id, userId, {oldDocs})
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when the doc is not the root doc", ->
			beforeEach ->
				@project.rootDoc_id = ObjectId()
				@ProjectEntityUpdateHandler._cleanUpDoc @project, @doc, @path, userId, @callback

			it "should not unset the root doc", ->
				@ProjectEntityUpdateHandler.unsetRootDoc.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true

	describe "_insertDeletedDocReference", ->
		beforeEach ->
			@doc =
				_id: ObjectId()
				name: "test.tex"
			@callback = sinon.stub()
			@ProjectModel.update = sinon.stub().yields()
			@ProjectEntityUpdateHandler._insertDeletedDocReference project_id, @doc, @callback

		it "should insert the doc into deletedDocs", ->
			@ProjectModel.update
				.calledWith({
					_id: project_id
				}, {
					$push: {
						deletedDocs: {
							_id: @doc._id
							name: @doc.name
						}
					}
				})
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true
