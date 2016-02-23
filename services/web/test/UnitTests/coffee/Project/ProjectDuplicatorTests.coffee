sinon = require('sinon')
chai = require('chai').should()
modulePath = "../../../../app/js/Features/Project/ProjectDuplicator.js"
SandboxedModule = require('sandboxed-module')

describe 'ProjectDuplicator', ->

	beforeEach ->
		@level2folder =
			name: "level2folderName"
			_id:"level2folderId"
			docs:[@doc2 = {_id: "doc2_id", name:"level2folderDocName"}]
			folders:[]
			fileRefs:[{name:"file2", _id:"file2"}]
		@level1folder =
			name:"level1folder"
			_id:"level1folderId"
			docs:[@doc1 = {_id: "doc1_id", name:"level1folderDocName"}]
			folders:[@level2folder]
			fileRefs:[{name:"file1", _id:"file1"}]
		@rootFolder = 
			name:"rootFolder"
			_id:"rootFolderId"
			docs:[@doc0 = {_id: "doc0_id", name:"rootDocHere"}]
			folders:[@level1folder]
			fileRefs:[{name:"file0", _id:"file0"}]
		@project = 
			_id: @project_id = "this_is_the_old_project"
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
			_id:"new_project_id"
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
			findRootDoc : sinon.stub().callsArgWith(1, null, @foundRootDoc)

		@projectOptionsHandler =
			setCompiler : sinon.stub()								
		@entityHandler =
			addDoc: sinon.stub().callsArgWith(4, null, {name:"somDoc"})
			copyFileFromExistingProject: sinon.stub().callsArgWith(4)
			setRootDoc: sinon.stub()
			addFolder: sinon.stub().callsArgWith(3, null, @newFolder)

		@DocumentUpdaterHandler =
			flushProjectToMongo: sinon.stub().callsArg(1)

		@Project =
			findById: sinon.stub().callsArgWith(1, null, @project)

		@duplicator = SandboxedModule.require modulePath, requires:
			'../../models/Project':{Project:@Project}
			"../DocumentUpdater/DocumentUpdaterHandler": @DocumentUpdaterHandler
			'./ProjectCreationHandler': @creationHandler
			'./ProjectEntityHandler': @entityHandler
			'./ProjectLocator': @locator
			'./ProjectOptionsHandler': @projectOptionsHandler
			"../Docstore/DocstoreManager": @DocstoreManager
			'logger-sharelatex':{log:->}

	it "should look up the original project", (done) ->
		newProjectName = "someProj"
		@duplicator.duplicate @owner, @project_id, newProjectName, (err, newProject)=>
			@Project.findById.calledWith(@project_id).should.equal true
			done()

	it "should flush the original project to mongo", (done) ->
		newProjectName = "someProj"
		@duplicator.duplicate @owner, @project_id, newProjectName, (err, newProject)=>
			@DocumentUpdaterHandler.flushProjectToMongo.calledWith(@project_id).should.equal true
			done()

	it 'should create a blank project', (done)->
		newProjectName = "someProj"
		@duplicator.duplicate @owner, @project_id, newProjectName, (err, newProject)=>
			newProject._id.should.equal @stubbedNewProject._id
			@creationHandler.createBlankProject.calledWith(@owner._id, newProjectName).should.equal true
			done()

	it 'should use the same compiler', (done)->
		@entityHandler.addDoc.callsArgWith(4, null, @rootFolder.docs[0])
		@duplicator.duplicate @owner, @project_id, "", (err, newProject)=>
			@projectOptionsHandler.setCompiler.calledWith(@stubbedNewProject._id, @project.compiler).should.equal true
			done()
	
	it 'should use the same root doc', (done)->
		@entityHandler.addDoc.callsArgWith(4, null, @rootFolder.docs[0])
		@duplicator.duplicate @owner, @project_id, "", (err, newProject)=>
			@entityHandler.setRootDoc.calledWith(@stubbedNewProject, @rootFolder.docs[0]._id).should.equal true
			done()

	it 'should not copy the collaberators or read only refs', (done)->
		@duplicator.duplicate @owner, @project_id, "", (err, newProject)=>
			newProject.collaberator_refs.length.should.equal 0
			newProject.readOnly_refs.length.should.equal 0
			done()	

	it 'should copy all the folders', (done)->
		@duplicator.duplicate @owner, @project_id, "", (err, newProject)=>
			@entityHandler.addFolder.calledWith(@stubbedNewProject._id, @stubbedNewProject.rootFolder[0]._id, @level1folder.name).should.equal true
			@entityHandler.addFolder.calledWith(@stubbedNewProject._id, @newFolder._id, @level2folder.name).should.equal true
			@entityHandler.addFolder.callCount.should.equal 2
			done()

	it 'should copy all the docs', (done)->
		@duplicator.duplicate @owner, @project_id, "", (err, newProject)=>
			@DocstoreManager.getAllDocs.calledWith(@project_id).should.equal true
			@entityHandler.addDoc.calledWith(@stubbedNewProject._id, @stubbedNewProject.rootFolder[0]._id, @doc0.name, @doc0_lines).should.equal true
			@entityHandler.addDoc.calledWith(@stubbedNewProject._id, @newFolder._id, @doc1.name, @doc1_lines).should.equal true
			@entityHandler.addDoc.calledWith(@stubbedNewProject._id, @newFolder._id, @doc2.name, @doc2_lines).should.equal true
			done()

	it 'should copy all the files', (done)->
		@duplicator.duplicate @owner, @project_id, "", (err, newProject)=>
			@entityHandler.copyFileFromExistingProject.calledWith(@stubbedNewProject, @stubbedNewProject.rootFolder[0]._id, @project._id, @rootFolder.fileRefs[0]).should.equal true
			@entityHandler.copyFileFromExistingProject.calledWith(@stubbedNewProject, @newFolder._id, @project._id, @level1folder.fileRefs[0]).should.equal true
			@entityHandler.copyFileFromExistingProject.calledWith(@stubbedNewProject, @newFolder._id, @project._id, @level2folder.fileRefs[0]).should.equal true
			done()
