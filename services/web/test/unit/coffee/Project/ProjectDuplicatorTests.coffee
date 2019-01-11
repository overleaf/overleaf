sinon = require('sinon')
chai = require('chai').should()
modulePath = "../../../../app/js/Features/Project/ProjectDuplicator.js"
SandboxedModule = require('sandboxed-module')

describe 'ProjectDuplicator', ->

	beforeEach ->
		@level2folder =
			name: "level2folderName"
			_id:"level2folderId"
			docs:[@doc2 = {_id: "doc2_id", name:"level2folderDocName"}, undefined]
			folders:[]
			fileRefs:[{name:"file2", _id:"file2"}]
		@level1folder =
			name:"level1folder"
			_id:"level1folderId"
			docs:[@doc1 = {_id: "doc1_id", name:"level1folderDocName"}]
			folders:[@level2folder]
			fileRefs:[{name:"file1", _id:"file1"}, null] # the null is intentional to test null docs/files
		@rootFolder = 
			name:"rootFolder"
			_id:"rootFolderId"
			docs:[@doc0 = {_id: "doc0_id", name:"rootDocHere"}]
			folders:[@level1folder, {}]
			fileRefs:[{name:"file0", _id:"file0"}]
		@project = 
			_id: @old_project_id = "this_is_the_old_project_id"
			rootDoc_id: "rootDoc_id"
			rootFolder:[@rootFolder]
			compiler: "this_is_a_Compiler"

		@docContents = [{
			_id: @doc0._id
			lines: @doc0_lines = ["zero"]
		}, {
			_id: @doc1._id
			lines: @doc1_lines = ["one"]
		}, {
			_id: @doc2._id
			lines: @doc2_lines = ["two"]
		}]
		@DocstoreManager = 
			getAllDocs: sinon.stub().callsArgWith(1, null, @docContents)

		@owner = {_id:"this_is_the_owner"}
		@stubbedNewProject = 
			_id: @new_project_id = "new_project_id"
			readOnly_refs:[]
			collaberator_refs:[]
			rootFolder:[
				{_id:"new_root_folder_id"}
			]
		@foundRootDoc = {_id:"rootDocId", name:"rootDocHere"}

		@creationHandler = 
			createBlankProject : sinon.stub().callsArgWith(2, null, @stubbedNewProject)

		@newFolder = {_id: "newFolderId"}

		@locator =
			findRootDoc : sinon.stub().callsArgWith(1, null, @foundRootDoc, {})

		@projectOptionsHandler =
			setCompiler : sinon.stub().callsArg(2)
		@ProjectEntityUpdateHandler =
			addDoc: sinon.stub().callsArgWith(5, null, {name:"somDoc"})
			copyFileFromExistingProjectWithProject: sinon.stub()
			setRootDoc: sinon.stub()
			addFolder: sinon.stub().callsArgWith(3, null, @newFolder)

		@ProjectEntityUpdateHandler.copyFileFromExistingProjectWithProject.withArgs(sinon.match.any, sinon.match.any, sinon.match.any, sinon.match.any, "BROKEN-FILE", sinon.match.any, sinon.match.any).callsArgWith(6, new Error("failed"))
		@ProjectEntityUpdateHandler.copyFileFromExistingProjectWithProject.withArgs(sinon.match.any, sinon.match.any, sinon.match.any, sinon.match.any, sinon.match.object, sinon.match.any).callsArg(6)
		@ProjectEntityUpdateHandler.copyFileFromExistingProjectWithProject.withArgs(sinon.match.any, sinon.match.any, sinon.match.any, sinon.match.any, null, sinon.match.any).callsArg(6)

		@DocumentUpdaterHandler =
			flushProjectToMongo: sinon.stub().callsArg(1)

		@Project =
			findById: sinon.stub().callsArgWith(1, null, @project)

		@ProjectGetter =
			getProject: sinon.stub()

		@ProjectGetter.getProject.withArgs(@old_project_id, sinon.match.any).callsArgWith(2, null, @project)
		@ProjectGetter.getProject.withArgs(@new_project_id, sinon.match.any).callsArgWith(2, null, @stubbedNewProject)

		@ProjectDeleter = 
			deleteProject: sinon.stub().callsArgWith(1,null)

		@duplicator = SandboxedModule.require modulePath, requires:
			'../../models/Project':{Project:@Project}
			"../DocumentUpdater/DocumentUpdaterHandler": @DocumentUpdaterHandler
			'./ProjectCreationHandler': @creationHandler
			'./ProjectEntityUpdateHandler': @ProjectEntityUpdateHandler
			'./ProjectLocator': @locator
			'./ProjectDeleter': @ProjectDeleter
			'./ProjectOptionsHandler': @projectOptionsHandler
			"../Docstore/DocstoreManager": @DocstoreManager
			"./ProjectGetter":@ProjectGetter
			'logger-sharelatex':{
				log:->
				err:->
			}

	describe "when the copy succeeds", ->

		it "should look up the original project", (done) ->
			newProjectName = "someProj"
			@duplicator.duplicate @owner, @old_project_id, newProjectName, (err, newProject)=>
				@ProjectGetter.getProject.calledWith(@old_project_id).should.equal true
				done()

		it "should flush the original project to mongo", (done) ->
			newProjectName = "someProj"
			@duplicator.duplicate @owner, @old_project_id, newProjectName, (err, newProject)=>
				@DocumentUpdaterHandler.flushProjectToMongo.calledWith(@old_project_id).should.equal true
				done()

		it 'should create a blank project', (done)->
			newProjectName = "someProj"
			@duplicator.duplicate @owner, @old_project_id, newProjectName, (err, newProject)=>
				newProject._id.should.equal @stubbedNewProject._id
				@creationHandler.createBlankProject.calledWith(@owner._id, newProjectName).should.equal true
				done()

		it 'should use the same compiler', (done)->
			@ProjectEntityUpdateHandler.addDoc.callsArgWith(5, null, @rootFolder.docs[0], @owner._id)
			@duplicator.duplicate @owner, @old_project_id, "", (err, newProject)=>
				@projectOptionsHandler.setCompiler.calledWith(@stubbedNewProject._id, @project.compiler).should.equal true
				done()
		
		it 'should use the same root doc', (done)->
			@ProjectEntityUpdateHandler.addDoc.callsArgWith(5, null, @rootFolder.docs[0], @owner._id)
			@duplicator.duplicate @owner, @old_project_id, "", (err, newProject)=>
				@ProjectEntityUpdateHandler.setRootDoc.calledWith(@stubbedNewProject._id, @rootFolder.docs[0]._id).should.equal true
				done()

		it 'should not copy the collaberators or read only refs', (done)->
			@duplicator.duplicate @owner, @old_project_id, "", (err, newProject)=>
				newProject.collaberator_refs.length.should.equal 0
				newProject.readOnly_refs.length.should.equal 0
				done()	

		it 'should copy all the folders', (done)->
			@duplicator.duplicate @owner, @old_project_id, "", (err, newProject)=>
				@ProjectEntityUpdateHandler.addFolder.calledWith(@new_project_id, @stubbedNewProject.rootFolder[0]._id, @level1folder.name).should.equal true
				@ProjectEntityUpdateHandler.addFolder.calledWith(@new_project_id, @newFolder._id, @level2folder.name).should.equal true
				@ProjectEntityUpdateHandler.addFolder.callCount.should.equal 2
				done()

		it 'should copy all the docs', (done)->
			@duplicator.duplicate @owner, @old_project_id, "", (err, newProject)=>
				@DocstoreManager.getAllDocs.calledWith(@old_project_id).should.equal true
				@ProjectEntityUpdateHandler.addDoc
					.calledWith(@new_project_id, @stubbedNewProject.rootFolder[0]._id, @doc0.name, @doc0_lines, @owner._id)
					.should.equal true
				@ProjectEntityUpdateHandler.addDoc
					.calledWith(@new_project_id, @newFolder._id, @doc1.name, @doc1_lines, @owner._id)
					.should.equal true
				@ProjectEntityUpdateHandler.addDoc
					.calledWith(@new_project_id, @newFolder._id, @doc2.name, @doc2_lines, @owner._id)
					.should.equal true
				done()

		it 'should copy all the files', (done)->
			@duplicator.duplicate @owner, @old_project_id, "", (err, newProject)=>
				@ProjectEntityUpdateHandler.copyFileFromExistingProjectWithProject
					.calledWith(@stubbedNewProject._id, @stubbedNewProject, @stubbedNewProject.rootFolder[0]._id, @project._id, @rootFolder.fileRefs[0], @owner._id)
					.should.equal true
				@ProjectEntityUpdateHandler.copyFileFromExistingProjectWithProject
					.calledWith(@stubbedNewProject._id, @stubbedNewProject, @newFolder._id, @project._id, @level1folder.fileRefs[0], @owner._id)
					.should.equal true
				@ProjectEntityUpdateHandler.copyFileFromExistingProjectWithProject
					.calledWith(@stubbedNewProject._id, @stubbedNewProject, @newFolder._id, @project._id, @level2folder.fileRefs[0], @owner._id)
					.should.equal true
				done()

	describe 'when there is an error', ->
		beforeEach ->
			@rootFolder.fileRefs = [{name:"file0", _id:"file0"}, "BROKEN-FILE", {name:"file1", _id:"file1"}, {name:"file2", _id:"file2"}]

		it 'should delete the broken cloned project', (done) ->
			@duplicator.duplicate @owner, @old_project_id, "", (err, newProject)=>
				@ProjectDeleter.deleteProject
					.calledWith(@stubbedNewProject._id)
					.should.equal true
				done()

		it 'should not delete the original project', (done) ->
			@duplicator.duplicate @owner, @old_project_id, "", (err, newProject)=>
				@ProjectDeleter.deleteProject
					.calledWith(@old_project_id)
					.should.equal false
				done()

		it 'should return an error', (done) ->
			@duplicator.duplicate @owner, @old_project_id, "", (err, newProject)=>
				err.should.not.equal null
				done()