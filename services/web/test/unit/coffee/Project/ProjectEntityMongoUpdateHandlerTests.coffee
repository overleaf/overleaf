chai = require('chai')
expect = chai.expect
assert = require('chai').assert
should = chai.should()
sinon = require 'sinon'
tk = require("timekeeper")
modulePath = "../../../../app/js/Features/Project/ProjectEntityMongoUpdateHandler"
Errors = require "../../../../app/js/Features/Errors/Errors"
ObjectId = require("mongoose").Types.ObjectId
SandboxedModule = require('sandboxed-module')

describe 'ProjectEntityMongoUpdateHandler', ->
	project_id = '4eecb1c1bffa66588e0000a1'
	doc_id = '4eecb1c1bffa66588e0000a2'
	file_id = '4eecb1c1bffa66588e0000a3'
	folder_id = "4eecaffcbffa66588e000008"

	beforeEach ->
		@FolderModel = class Folder
			constructor:(options)->
				{@name} = options
				@._id = "folder_id"

		@docName = "doc-name"
		@fileName = "something.jpg"
		@project = _id: project_id, name: 'project name'

		@callback = sinon.stub()

		tk.freeze(Date.now())
		@subject = SandboxedModule.require modulePath, requires:
			'logger-sharelatex': @logger = {log:sinon.stub(), error: sinon.stub(), err:->}
			"settings-sharelatex":@settings = {
				maxEntitiesPerProject: 100
			}
			"../Cooldown/CooldownManager": @CooldownManager = {}
			'../../models/Folder': Folder:@FolderModel
			"../../infrastructure/LockManager":@LockManager =
				runWithLock:
					sinon.spy((namespace, id, runner, callback) -> runner(callback))
			'../../models/Project': Project:@ProjectModel = {}
			'./ProjectEntityHandler': @ProjectEntityHandler = {}
			'./ProjectLocator': @ProjectLocator = {}
			"./ProjectGetter": @ProjectGetter =
				getProjectWithoutLock: sinon.stub().yields(null, @project)

	afterEach ->
		tk.reset()

	describe 'addDoc', ->
		beforeEach ->
			@subject._confirmFolder = sinon.stub().yields(folder_id)
			@subject._putElement = sinon.stub()

			@doc = _id: doc_id
			@subject.addDoc project_id, folder_id, @doc, @callback

		it 'gets the project', ->
			@ProjectGetter.getProjectWithoutLock
				.calledWith(project_id, {rootFolder:true, name:true, overleaf:true})
				.should.equal true

		it 'checks the folder exists', ->
			@subject._confirmFolder
				.calledWith(@project, folder_id)
				.should.equal true

		it 'puts the element in mongo', ->
			@subject._putElement
				.calledWith(@project, folder_id, @doc, 'doc', @callback)
				.should.equal true

	describe 'addFile', ->
		beforeEach ->
			@subject._confirmFolder = sinon.stub().yields(folder_id)
			@subject._putElement = sinon.stub()

			@file = _id: file_id
			@subject.addFile project_id, folder_id, @file, @callback

		it 'gets the project', ->
			@ProjectGetter.getProjectWithoutLock
				.calledWith(project_id, {rootFolder:true, name:true, overleaf:true})
				.should.equal true

		it 'checks the folder exists', ->
			@subject._confirmFolder
				.calledWith(@project, folder_id)
				.should.equal true

		it 'puts the element in mongo', ->
			@subject._putElement
				.calledWith(@project, folder_id, @file, 'file', @callback)
				.should.equal true

	describe 'replaceFileWithNew', ->
		beforeEach ->
			@file = _id: file_id
			@path = mongo: 'file.png'
			@newFile = _id: 'new-file-id'
			@newFile.linkedFileData = @linkedFileData = {provider: 'url'}
			@ProjectLocator.findElement = sinon.stub().yields(null, @file, @path)
			@ProjectModel.update = sinon.stub().yields()

			@subject.replaceFileWithNew project_id, file_id, @newFile, @callback

		it 'gets the project', ->
			@ProjectGetter.getProjectWithoutLock
				.calledWith(project_id, {rootFolder:true, name:true, overleaf:true})
				.should.equal true

		it 'finds the existing element', ->
			@ProjectLocator.findElement
				.calledWith({ @project, element_id: file_id, type: 'file' })
				.should.equal true

		it 'inserts a deletedFile reference for the old file', ->
			@ProjectModel.update
				.calledWith({ _id: project_id },
					{
						$push: {
							deletedFiles: {
								_id:  file_id
								name: @file.name
								linkedFileData: @file.linkedFileData
								deletedAt: new Date()
							}
						}
					}
				)
				.should.equal true

		it 'increments the project version and sets the rev and created_at', ->
			@ProjectModel.update
				.calledWith(
					{ _id: project_id },
					{
						'$inc': { 'version': 1, 'file.png.rev': 1 }
						'$set': { 'file.png._id': @newFile._id, 'file.png.created': new Date(), 'file.png.linkedFileData': @linkedFileData }
					}
					{}
				)
				.should.equal true

		it 'calls the callback', ->
			@callback.calledWith(null, @file, @project, @path).should.equal true

	describe 'mkdirp', ->
		beforeEach ->
			@parentFolder_id = "1jnjknjk"
			@newFolder = {_id:"newFolder_id_here"}
			@lastFolder = {_id:"123das", folders:[]}

			@rootFolder = {_id: "rootFolderId" }
			@project = _id: project_id, rootFolder: [@rootFolder]

			@ProjectGetter.getProjectWithOnlyFolders = sinon.stub().yields(null, @project)
			@ProjectLocator.findElementByPath = ->
			sinon.stub @ProjectLocator, "findElementByPath", (options, cb) =>
				{path} = options
				@parentFolder = {_id:"parentFolder_id_here"}
				lastFolder = path.substring(path.lastIndexOf("/"))
				if lastFolder.indexOf("level1") == -1
					cb "level1 is not the last foler "
				else
					cb null, @parentFolder
			@subject.addFolder =
				withoutLock: (project_id, parentFolder_id, folderName, callback) =>
					callback null, {name:folderName}, @parentFolder_id

		it 'should return the root folder if the path is just a slash', (done)->
			path = "/"
			@subject.mkdirp project_id, path, {}, (err, folders, lastFolder)=>
				lastFolder.should.deep.equal @rootFolder
				assert.equal lastFolder.parentFolder_id, undefined
				done()

		it 'should make just one folder', (done)->
			path = "/differentFolder/"
			@subject.mkdirp project_id, path, {}, (err, folders, lastFolder)=>
				folders.length.should.equal 1
				lastFolder.name.should.equal "differentFolder"
				lastFolder.parentFolder_id.should.equal @parentFolder_id
				done()

		it 'should make the final folder in path if it doesnt exist with one level', (done)->
			path = "level1/level2"
			@subject.mkdirp project_id, path, {}, (err, folders, lastFolder)=>
				folders.length.should.equal 1
				lastFolder.name.should.equal "level2"
				lastFolder.parentFolder_id.should.equal @parentFolder_id
				done()

		it 'should make the final folder in path if it doesnt exist with mutliple levels', (done)->
			path = "level1/level2/level3"

			@subject.mkdirp project_id, path, {}, (err, folders, lastFolder) =>
				folders.length.should.equal 2
				folders[0].name.should.equal "level2"
				folders[0].parentFolder_id.should.equal @parentFolder_id
				lastFolder.name.should.equal "level3"
				lastFolder.parentFolder_id.should.equal @parentFolder_id
				done()

		it 'should work with slashes either side', (done)->
			path = "/level1/level2/level3/"

			@subject.mkdirp project_id, path, {}, (err, folders, lastFolder)=>
				folders.length.should.equal 2
				folders[0].name.should.equal "level2"
				folders[0].parentFolder_id.should.equal @parentFolder_id
				lastFolder.name.should.equal "level3"
				lastFolder.parentFolder_id.should.equal @parentFolder_id
				done()

		it 'should use a case-insensitive match by default', (done)->
			path = "/differentFolder/"
			@subject.mkdirp project_id, path, {}, (err, folders, lastFolder)=>
				@ProjectLocator.findElementByPath.calledWithMatch({exactCaseMatch:undefined})
				.should.equal true
				done()

		it 'should use a case-sensitive match if exactCaseMatch option is set', (done)->
			path = "/differentFolder/"
			@subject.mkdirp project_id, path, {exactCaseMatch:true}, (err, folders, lastFolder)=>
				@ProjectLocator.findElementByPath.calledWithMatch({exactCaseMatch:true})
				.should.equal true
				done()

	describe 'moveEntity', ->
		beforeEach ->
			@pathAfterMove = {
				fileSystem: "/somewhere/else.txt"
			}

			@ProjectEntityHandler.getAllEntitiesFromProject = sinon.stub()
			@ProjectEntityHandler.getAllEntitiesFromProject
				.onFirstCall()
				.yields(null, @oldDocs = ['old-doc'], @oldFiles = ['old-file'])
			@ProjectEntityHandler.getAllEntitiesFromProject
				.onSecondCall()
				.yields(null, @newDocs = ['new-doc'], @newFiles = ['new-file'])

			@doc = {lines:["1234","312343d"], rev: "1234"}
			@path = { mongo:"folders[0]", fileSystem:"/old_folder/somewhere.txt" }
			@ProjectLocator.findElement = sinon.stub()
				.withArgs({@project, element_id: @docId, type: 'docs'})
				.yields(null, @doc, @path)

			@subject._checkValidMove = sinon.stub().yields()

			@subject._removeElementFromMongoArray = sinon.stub().yields(null, @project)
			@subject._putElement = sinon.stub().yields(null, path: @pathAfterMove)

			@subject.moveEntity project_id, doc_id, folder_id, "docs", @callback

		it 'should get the project', ->
			@ProjectGetter.getProjectWithoutLock
				.calledWith(project_id, {rootFolder:true, name:true, overleaf:true})
				.should.equal true

		it 'should find the doc to move', ->
			@ProjectLocator.findElement
				.calledWith({element_id: doc_id, type: "docs", project: @project })
				.should.equal true

		it 'should check this is a valid move', ->
			@subject._checkValidMove
				.calledWith(@project, 'docs', @doc, @path, folder_id)
				.should.equal true

		it 'should remove the element from its current position', ->
			@subject._removeElementFromMongoArray
				.calledWith(@ProjectModel, project_id, @path.mongo)
				.should.equal true

		it "should put the element back in the new folder", ->
			@subject._putElement
				.calledWith(@project, folder_id, @doc, "docs")
				.should.equal true

		it "calls the callback", ->
			changes = { @oldDocs, @newDocs, @oldFiles, @newFiles }
			@callback.calledWith(
				null, @project, @path.fileSystem, @pathAfterMove.fileSystem, @doc.rev, changes
			).should.equal true

	describe 'deleteEntity', ->
		beforeEach ->
			@path = mongo: "mongo.path", fileSystem: "/file/system/path"
			@doc = _id: doc_id
			@ProjectLocator.findElement = sinon.stub().callsArgWith(1, null, @doc, @path)
			@subject._removeElementFromMongoArray = sinon.stub().yields()
			@subject.deleteEntity project_id, doc_id, 'doc', @callback

		it "should get the project", ->
			@ProjectGetter.getProjectWithoutLock
				.calledWith(project_id, {rootFolder:true, name:true, overleaf:true})
				.should.equal true

		it "should find the element", ->
			@ProjectLocator.findElement
				.calledWith({@project, element_id: @doc._id, type: 'doc'})
				.should.equal true

		it "should remove the element from the database", ->
			@subject._removeElementFromMongoArray
				.calledWith(@ProjectModel, project_id, @path.mongo)
				.should.equal true

		it "calls the callbck", ->
			@callback.calledWith(null, @doc, @path, @project).should.equal true

	describe "renameEntity", ->
		beforeEach ->
			@newName = "new.tex"
			@path = mongo: "mongo.path", fileSystem: "/old.tex"

			@project =
				_id: ObjectId(project_id)
				rootFolder: [_id:ObjectId()]
			@doc = _id: doc_id, name: "old.tex", rev: 1
			@folder = _id: folder_id

			@ProjectGetter.getProjectWithoutLock = sinon.stub().yields(null, @project)

			@ProjectEntityHandler.getAllEntitiesFromProject = sinon.stub()
			@ProjectEntityHandler.getAllEntitiesFromProject
				.onFirstCall()
				.yields( null, @oldDocs = ['old-doc'], @oldFiles = ['old-file'])
			@ProjectEntityHandler.getAllEntitiesFromProject
				.onSecondCall()
				.yields( null, @newDocs = ['new-doc'], @newFiles = ['new-file'])

			@ProjectLocator.findElement = sinon.stub().yields(null, @doc, @path, @folder)
			@subject._checkValidElementName = sinon.stub().yields()
			@ProjectModel.findOneAndUpdate = sinon.stub().callsArgWith(3, null, @project)

			@subject.renameEntity project_id, doc_id, 'doc', @newName, @callback

		it 'should get the project', ->
			@ProjectGetter.getProjectWithoutLock
				.calledWith(project_id, {rootFolder:true, name:true, overleaf:true})
				.should.equal true

		it 'should find the doc', ->
			@ProjectLocator.findElement
				.calledWith({element_id: doc_id, type: 'doc', project: @project })
				.should.equal true

		it 'should check the new name is valid', ->
			@subject._checkValidElementName
				.calledWith(@folder, @newName)
				.should.equal true

		it 'should update the doc name', ->
			@ProjectModel.findOneAndUpdate
				.calledWith(
					{ _id: project_id },
					{ $set: { "mongo.path.name": @newName }, $inc: {"version": 1} },
					{ new: true }
				).should.equal true

		it 'calls the callback', ->
			changes = { @oldDocs, @newDocs, @oldFiles, @newFiles }
			@callback.calledWith(
				null, @project, '/old.tex', '/new.tex', @doc.rev, changes
			).should.equal true

	describe 'addFolder', ->
		beforeEach ->
			@folderName = "folder1234"
			@ProjectGetter.getProjectWithOnlyFolders = sinon.stub().callsArgWith(1, null, @project)
			@subject._confirmFolder = sinon.stub().yields(folder_id)
			@subject._putElement = sinon.stub().yields()

			@subject.addFolder project_id, folder_id, @folderName, @callback

		it 'gets the project', ->
			@ProjectGetter.getProjectWithoutLock
				.calledWith(project_id, {rootFolder:true, name:true, overleaf:true})
				.should.equal true

		it 'checks the parent folder exists', ->
			@subject._confirmFolder
				.calledWith(@project, folder_id)
				.should.equal true

		it 'puts the element in mongo', ->
			folderMatcher = sinon.match (folder) =>
				folder.name == @folderName

			@subject._putElement
				.calledWithMatch(@project, folder_id, folderMatcher, 'folder')
				.should.equal true

		it 'calls the callback', ->
			folderMatcher = sinon.match (folder) =>
				folder.name == @folderName

			@callback.calledWithMatch(null, folderMatcher, folder_id).should.equal true

	describe '_removeElementFromMongoArray ', ->
		beforeEach ->
			@mongoPath = "folders[0].folders[5]"
			@id = "12344"
			@ProjectModel.update = sinon.stub().yields()
			@ProjectModel.findOneAndUpdate = sinon.stub().yields(null, @project)
			@subject._removeElementFromMongoArray @ProjectModel, @id, @mongoPath, @callback

		it 'should unset', ->
			update = { '$unset': { } }
			update['$unset'][@mongoPath] = 1
			@ProjectModel.update
				.calledWith({ _id: @id }, update, {})
				.should.equal true

		it 'should pull', ->
			@ProjectModel.findOneAndUpdate
				.calledWith({ _id: @id }, { '$pull': { 'folders[0]': null }, '$inc': {'version': 1} }, {'new': true})
				.should.equal true

		it 'should call the callback', ->
			@callback.calledWith(null, @project).should.equal true

	describe "_countElements", ->
		beforeEach ->
			@project =
				_id: project_id,
				rootFolder: [
					docs: [{_id:123}, {_id:345}]
					fileRefs: [{_id:123}, {_id:345}, {_id:456}]
					folders: [
						{
							docs: [{_id:123}, {_id:345}, {_id:456}]
							fileRefs:{}
							folders: [
								{
									docs:[_id:1234],
									fileRefs:[{_id:23123}, {_id:123213}, {_id:2312}]
									folders:[
										{
											docs:[{_id:321321}, {_id:123213}]
											fileRefs:[{_id:312321}]
											folders:[]
										}
									]
								}
							]
						},{
							docs:[{_id:123}, {_id:32131}]
							fileRefs:[]
							folders:[
								{
									docs:[{_id:3123}]
									fileRefs:[{_id:321321}, {_id:321321}, {_id:313122}]
									folders:0
								}
							]
						}
					]
				]

		it "should return the correct number", ->
			expect(@subject._countElements @project).to.equal(26)

		it "should deal with null folders", ->
			@project.rootFolder[0].folders[0].folders = undefined
			expect(@subject._countElements @project).to.equal(17)

		it "should deal with null docs", ->
			@project.rootFolder[0].folders[0].docs = undefined
			expect(@subject._countElements @project).to.equal(23)

		it "should deal with null fileRefs", ->
			@project.rootFolder[0].folders[0].folders[0].fileRefs = undefined
			expect(@subject._countElements @project).to.equal(23)

	describe "_putElement", ->
		beforeEach ->
			@project =
				_id: project_id
				rootFolder: [_id:ObjectId()]
			@folder =
				_id: ObjectId()
				name: "someFolder"
				docs: [ {name: "another-doc.tex"} ]
				fileRefs: [ {name: "another-file.tex"} ]
				folders: [ {name: "another-folder"} ]
			@doc =
				_id: ObjectId()
				name: "new.tex"
			@path = mongo: "mongo.path", fileSystem: "/file/system/old.tex"
			@ProjectLocator.findElement = sinon.stub().yields(null, @folder, @path)
			@ProjectModel.findOneAndUpdate = sinon.stub().yields(null, @project)

		describe "updating the project", ->
			it "should use the correct mongo path", (done)->
				@subject._putElement @project, @folder._id, @doc, "docs", (err)=>
					@ProjectModel.findOneAndUpdate.args[0][0]._id.should.equal @project._id
					assert.deepEqual @ProjectModel.findOneAndUpdate.args[0][1].$push[@path.mongo+".docs"], @doc
					done()

			it "should return the project in the callback", (done)->
				@subject._putElement @project, @folder._id, @doc, "docs", (err, path, project)=>
					assert.equal project, @project
					done()

			it "should add an s onto the type if not included", (done)->
				@subject._putElement @project, @folder._id, @doc, "doc", (err)=>
					assert.deepEqual @ProjectModel.findOneAndUpdate.args[0][1].$push[@path.mongo+".docs"], @doc
					done()

			it "should not call update if element is null", (done)->
				@subject._putElement @project, @folder._id, null, "doc", (err)=>
					@ProjectModel.findOneAndUpdate.called.should.equal false
					done()

			it "should default to root folder insert", (done)->
				@subject._putElement @project, null, @doc, "doc", (err)=>
					@ProjectLocator.findElement.args[0][0].element_id.should.equal @project.rootFolder[0]._id
					done()

			it "should error if the element has no _id", (done)->
				doc =
					name:"something"
				@subject._putElement @project, @folder._id, doc, "doc", (err)=>
					@ProjectModel.findOneAndUpdate.called.should.equal false
					done()

			it "should error if element name contains invalid characters", (done)->
				doc =
					_id: ObjectId()
					name: "something*bad"
				@subject._putElement @project, @folder._id, doc, "doc", (err)=>
					@ProjectModel.findOneAndUpdate.called.should.equal false
					err.should.deep.equal new Errors.InvalidNameError("invalid element name")
					done()

			it "should error if element name is too long", (done)->
				doc =
					_id: ObjectId()
					name: new Array(200).join("long-") + "something"
				@subject._putElement @project, @folder._id, doc, "doc", (err)=>
					@ProjectModel.findOneAndUpdate.called.should.equal false
					err.should.deep.equal new Errors.InvalidNameError("invalid element name")
					done()

			it "should error if the folder name is too long", (done)->
				@path =
					mongo: "mongo.path",
					fileSystem: new Array(200).join("subdir/") + "foo"
				@ProjectLocator.findElement.callsArgWith(1, null, @folder, @path)
				doc =
					_id: ObjectId()
					name: "something"
				@subject._putElement @project, @folder._id, doc, "doc", (err)=>
					@ProjectModel.findOneAndUpdate.called.should.equal false
					err.should.deep.equal new Errors.InvalidNameError("path too long")
					done()

			it "should error if a document already exists with the same name", (done)->
				doc =
					_id: ObjectId()
					name: "another-doc.tex"
				@subject._putElement @project, @folder, doc, "doc", (err)=>
					@ProjectModel.findOneAndUpdate.called.should.equal false
					err.should.deep.equal new Errors.InvalidNameError("file already exists")
					done()

			it "should error if a file already exists with the same name", (done)->
				doc =
					_id: ObjectId()
					name: "another-file.tex"
				@subject._putElement @project, @folder, doc, "doc", (err)=>
					@ProjectModel.findOneAndUpdate.called.should.equal false
					err.should.deep.equal new Errors.InvalidNameError("file already exists")
					done()

			it "should error if a folder already exists with the same name", (done)->
				doc =
					_id: ObjectId()
					name: "another-folder"
				@subject._putElement @project, @folder, doc, "doc", (err)=>
					@ProjectModel.findOneAndUpdate.called.should.equal false
					err.should.deep.equal new Errors.InvalidNameError("file already exists")
					done()

	describe '_checkValidElementName', ->
		beforeEach ->
			@folder =
				docs: [ name: 'doc_name' ]
				fileRefs: [ name: 'file_name' ]
				folders: [ name: 'folder_name' ]

		it 'returns an error if name matches any doc name', ->
			@subject._checkValidElementName @folder, 'doc_name', (err) ->
				expect(err).to.deep.equal new Errors.InvalidNameError("file already exists")

		it 'returns an error if name matches any file name', ->
			@subject._checkValidElementName @folder, 'file_name', (err) ->
				expect(err).to.deep.equal new Errors.InvalidNameError("file already exists")

		it 'returns an error if name matches any folder name', ->
			@subject._checkValidElementName @folder, 'folder_name', (err) ->
				expect(err).to.deep.equal new Errors.InvalidNameError("file already exists")

		it 'returns nothing if name is valid', ->
			@subject._checkValidElementName @folder, 'unique_name', (err) ->
				expect(err).to.be.undefined

	describe '_checkValidMove', ->
		beforeEach ->
			@destFolder = _id: folder_id
			@destFolderPath = fileSystem: '/foo/bar'
			@ProjectLocator.findElement = sinon.stub().yields(null, @destFolder, @destFolderPath)
			@subject._checkValidElementName = sinon.stub().yields()

		it 'checks the element name is valid', ->
			@doc = _id: doc_id, name: 'doc_name'
			@subject._checkValidMove @project, 'doc', @doc, fileSystem: '/main.tex', @destFolder._id, (err) =>
				expect(err).to.be.undefined
				@subject._checkValidElementName
					.calledWith(@destFolder, @doc.name)
					.should.equal true

		it 'returns an error if trying to move a folder inside itself', ->
			folder = name: 'folder_name'
			@subject._checkValidMove @project, 'folder', folder, fileSystem: '/foo', @destFolder._id, (err) =>
				expect(err).to.deep.equal new Errors.InvalidNameError("destination folder is a child folder of me")

	describe "_insertDeletedDocReference", ->
		beforeEach ->
			@doc =
				_id: ObjectId()
				name: "test.tex"
			@callback = sinon.stub()
			@ProjectModel.update = sinon.stub().yields()
			@subject._insertDeletedDocReference project_id, @doc, @callback

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
