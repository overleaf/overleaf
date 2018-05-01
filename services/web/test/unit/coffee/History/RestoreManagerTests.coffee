SandboxedModule = require('sandboxed-module')
assert = require('assert')
require('chai').should()
expect = require('chai').expect
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/History/RestoreManager'
Errors = require '../../../../app/js/Features/Errors/Errors'
tk = require("timekeeper")
moment = require('moment')

describe 'RestoreManager', ->
	beforeEach ->
		@RestoreManager = SandboxedModule.require modulePath, requires:
			'../../infrastructure/FileWriter': @FileWriter = {}
			'../Uploads/FileSystemImportManager': @FileSystemImportManager = {}
			'../Project/ProjectLocator': @ProjectLocator = {}
			'../Errors/Errors': Errors
			'../Project/ProjectEntityHandler': @ProjectEntityHandler = {}
			'../Editor/EditorController': @EditorController = {}
			'logger-sharelatex': @logger = {log: sinon.stub(), err: sinon.stub()}
		@user_id = 'mock-user-id'
		@project_id = 'mock-project-id'
		@version = 42
		@callback = sinon.stub()
		tk.freeze Date.now() # freeze the time for these tests

	afterEach ->
		tk.reset()

	describe 'restoreFileFromV2', ->
		beforeEach ->
			@RestoreManager._writeFileVersionToDisk = sinon.stub().yields(null, @fsPath = "/tmp/path/on/disk")
			@RestoreManager._findOrCreateFolder = sinon.stub().yields(null, @folder_id = 'mock-folder-id')
			@FileSystemImportManager.addEntity = sinon.stub().yields(null, @entity = 'mock-entity')

		describe "with a file not in a folder", ->
			beforeEach ->
				@pathname = 'foo.tex'
				@RestoreManager.restoreFileFromV2 @user_id, @project_id, @version, @pathname, @callback

			it 'should write the file version to disk', ->
				@RestoreManager._writeFileVersionToDisk
					.calledWith(@project_id, @version, @pathname)
					.should.equal true

			it 'should find the root folder', ->
				@RestoreManager._findOrCreateFolder
					.calledWith(@project_id, "")
					.should.equal true

			it 'should add the entity', ->
				@FileSystemImportManager.addEntity
					.calledWith(@user_id, @project_id, @folder_id, 'foo.tex', @fsPath, false)
					.should.equal true

			it 'should call the callback with the entity', ->
				@callback.calledWith(null, @entity).should.equal true

		describe "with a file in a folder", ->
			beforeEach ->
				@pathname = 'foo/bar.tex'
				@RestoreManager.restoreFileFromV2 @user_id, @project_id, @version, @pathname, @callback

			it 'should find the folder', ->
				@RestoreManager._findOrCreateFolder
					.calledWith(@project_id, "foo")
					.should.equal true

			it 'should add the entity by its basename', ->
				@FileSystemImportManager.addEntity
					.calledWith(@user_id, @project_id, @folder_id, 'bar.tex', @fsPath, false)
					.should.equal true

	describe '_findOrCreateFolder', ->
		beforeEach ->
			@EditorController.mkdirp = sinon.stub().yields(null, [], {_id: @folder_id = 'mock-folder-id'})
			@RestoreManager._findOrCreateFolder @project_id, 'folder/name', @callback

		it 'should look up or create the folder', ->
			@EditorController.mkdirp
				.calledWith(@project_id, 'folder/name')
				.should.equal true

		it 'should return the folder_id', ->
			@callback.calledWith(null, @folder_id).should.equal true


	describe '_addEntityWithUniqueName', ->
		beforeEach ->
			@addEntityWithName = sinon.stub()
			@name = 'foo.tex'

		describe 'with a valid name', ->
			beforeEach ->
				@addEntityWithName.yields(null, @entity = 'mock-entity')
				@RestoreManager._addEntityWithUniqueName @addEntityWithName, @name, @callback

			it 'should add the entity', ->
				@addEntityWithName.calledWith(@name).should.equal true

			it 'should return the entity', ->
				@callback.calledWith(null, @entity).should.equal true

		describe "with an invalid name", ->
			beforeEach ->
				@addEntityWithName.onFirstCall().yields(new Errors.InvalidNameError())
				@addEntityWithName.onSecondCall().yields(null, @entity = 'mock-entity')
				@RestoreManager._addEntityWithUniqueName @addEntityWithName, @name, @callback

			it 'should try to add the entity with its original name', ->
				@addEntityWithName.calledWith('foo.tex').should.equal true

			it 'should try to add the entity with a unique name', ->
				date = moment(new Date()).format('Do MMM YY H:mm:ss')
				@addEntityWithName.calledWith("foo (Restored on #{date}).tex").should.equal true

			it 'should return the entity', ->
				@callback.calledWith(null, @entity).should.equal true
