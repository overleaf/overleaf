const { expect } = require('chai')
const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')

const MODULE_PATH = '../../../../app/src/Features/Project/ProjectDuplicator.js'

describe('ProjectDuplicator', function() {
  beforeEach(function() {
    this.level2folder = {
      name: 'level2folderName',
      _id: 'level2folderId',
      docs: [
        (this.doc2 = { _id: 'doc2_id', name: 'level2folderDocName' }),
        undefined
      ],
      folders: [],
      fileRefs: [{ name: 'file2', _id: 'file2' }]
    }
    this.level1folder = {
      name: 'level1folder',
      _id: 'level1folderId',
      docs: [(this.doc1 = { _id: 'doc1_id', name: 'level1folderDocName' })],
      folders: [this.level2folder],
      fileRefs: [{ name: 'file1', _id: 'file1' }, null] // the null is intentional to test null docs/files
    }
    this.rootFolder = {
      name: 'rootFolder',
      _id: 'rootFolderId',
      docs: [(this.doc0 = { _id: 'doc0_id', name: 'rootDocHere' })],
      folders: [this.level1folder, {}],
      fileRefs: [{ name: 'file0', _id: 'file0' }]
    }
    this.project = {
      _id: (this.old_project_id = 'this_is_the_old_project_id'),
      rootDoc_id: 'rootDoc_id',
      rootFolder: [this.rootFolder],
      compiler: 'this_is_a_Compiler'
    }

    this.docContents = [
      {
        _id: this.doc0._id,
        lines: (this.doc0_lines = ['zero'])
      },
      {
        _id: this.doc1._id,
        lines: (this.doc1_lines = ['one'])
      },
      {
        _id: this.doc2._id,
        lines: (this.doc2_lines = ['two'])
      }
    ]
    this.DocstoreManager = {
      promises: {
        getAllDocs: sinon.stub().resolves(this.docContents)
      }
    }

    this.owner = { _id: 'this_is_the_owner' }
    this.stubbedNewProject = {
      _id: (this.new_project_id = 'new_project_id'),
      readOnly_refs: [],
      collaberator_refs: [],
      rootFolder: [{ _id: 'new_root_folder_id' }]
    }
    this.foundRootDoc = { _id: 'rootDocId', name: 'rootDocHere' }

    this.ProjectCreationHandler = {
      promises: {
        createBlankProject: sinon.stub().resolves(this.stubbedNewProject)
      }
    }

    this.newFolder = { _id: 'newFolderId' }

    this.ProjectLocator = {
      promises: {
        findRootDoc: sinon
          .stub()
          .resolves({ element: this.foundRootDoc, path: {} })
      }
    }

    this.ProjectOptionsHandler = {
      promises: {
        setCompiler: sinon.stub().resolves()
      }
    }
    this.ProjectEntityUpdateHandler = {
      addDoc: sinon.stub().callsArgWith(5, null, { name: 'somDoc' }),
      copyFileFromExistingProjectWithProject: sinon.stub(),
      setRootDoc: sinon.stub(),
      addFolder: sinon.stub().callsArgWith(3, null, this.newFolder)
    }

    this.ProjectEntityUpdateHandler.copyFileFromExistingProjectWithProject
      .withArgs(
        sinon.match.any,
        sinon.match.any,
        sinon.match.any,
        sinon.match.any,
        'BROKEN-FILE',
        sinon.match.any,
        sinon.match.any
      )
      .callsArgWith(6, new Error('failed'))
    this.ProjectEntityUpdateHandler.copyFileFromExistingProjectWithProject
      .withArgs(
        sinon.match.any,
        sinon.match.any,
        sinon.match.any,
        sinon.match.any,
        sinon.match.object,
        sinon.match.any
      )
      .callsArg(6)
    this.ProjectEntityUpdateHandler.copyFileFromExistingProjectWithProject
      .withArgs(
        sinon.match.any,
        sinon.match.any,
        sinon.match.any,
        sinon.match.any,
        null,
        sinon.match.any
      )
      .callsArg(6)

    this.DocumentUpdaterHandler = {
      promises: {
        flushProjectToMongo: sinon.stub().resolves()
      }
    }

    this.Project = {
      promises: {
        findById: sinon.stub().resolves(this.project)
      }
    }

    this.ProjectGetter = {
      getProject: sinon.stub(),
      promises: {
        getProject: sinon.stub()
      }
    }

    this.ProjectGetter.getProject
      .withArgs(this.old_project_id, sinon.match.any)
      .callsArgWith(2, null, this.project)
    this.ProjectGetter.getProject
      .withArgs(this.new_project_id, sinon.match.any)
      .callsArgWith(2, null, this.stubbedNewProject)
    this.ProjectGetter.promises.getProject
      .withArgs(this.old_project_id, sinon.match.any)
      .resolves(this.project)
    this.ProjectGetter.promises.getProject
      .withArgs(this.new_project_id, sinon.match.any)
      .resolves(this.stubbedNewProject)

    this.ProjectDeleter = {
      promises: {
        deleteProject: sinon.stub().resolves()
      }
    }

    this.ProjectDuplicator = SandboxedModule.require(MODULE_PATH, {
      globals: {
        console: console
      },
      requires: {
        '../../models/Project': { Project: this.Project },
        '../DocumentUpdater/DocumentUpdaterHandler': this
          .DocumentUpdaterHandler,
        './ProjectCreationHandler': this.ProjectCreationHandler,
        './ProjectEntityUpdateHandler': this.ProjectEntityUpdateHandler,
        './ProjectLocator': this.ProjectLocator,
        './ProjectDeleter': this.ProjectDeleter,
        './ProjectOptionsHandler': this.ProjectOptionsHandler,
        '../Docstore/DocstoreManager': this.DocstoreManager,
        './ProjectGetter': this.ProjectGetter,
        'logger-sharelatex': {
          log() {},
          warn() {},
          err() {}
        }
      }
    })
  })

  describe('when the copy succeeds', function() {
    it('should look up the original project', async function() {
      const newProjectName = 'someProj'
      await this.ProjectDuplicator.promises.duplicate(
        this.owner,
        this.old_project_id,
        newProjectName
      )
      this.ProjectGetter.promises.getProject.should.have.been.calledWith(
        this.old_project_id
      )
    })

    it('should flush the original project to mongo', async function() {
      const newProjectName = 'someProj'
      await this.ProjectDuplicator.promises.duplicate(
        this.owner,
        this.old_project_id,
        newProjectName
      )
      this.DocumentUpdaterHandler.promises.flushProjectToMongo.should.have.been.calledWith(
        this.old_project_id
      )
    })

    it('should create a blank project', async function() {
      const newProjectName = 'someProj'
      const newProject = await this.ProjectDuplicator.promises.duplicate(
        this.owner,
        this.old_project_id,
        newProjectName
      )
      newProject._id.should.equal(this.stubbedNewProject._id)
      this.ProjectCreationHandler.promises.createBlankProject.should.have.been.calledWith(
        this.owner._id,
        newProjectName
      )
    })

    it('should use the same compiler', async function() {
      this.ProjectEntityUpdateHandler.addDoc.callsArgWith(
        5,
        null,
        this.rootFolder.docs[0],
        this.owner._id
      )
      await this.ProjectDuplicator.promises.duplicate(
        this.owner,
        this.old_project_id,
        ''
      )
      this.ProjectOptionsHandler.promises.setCompiler.should.have.been.calledWith(
        this.stubbedNewProject._id,
        this.project.compiler
      )
    })

    it('should use the same root doc', async function() {
      this.ProjectEntityUpdateHandler.addDoc.callsArgWith(
        5,
        null,
        this.rootFolder.docs[0],
        this.owner._id
      )
      await this.ProjectDuplicator.promises.duplicate(
        this.owner,
        this.old_project_id,
        ''
      )
      this.ProjectEntityUpdateHandler.setRootDoc.should.have.been.calledWith(
        this.stubbedNewProject._id,
        this.rootFolder.docs[0]._id
      )
    })

    it('should not copy the collaberators or read only refs', async function() {
      const newProject = await this.ProjectDuplicator.promises.duplicate(
        this.owner,
        this.old_project_id,
        ''
      )
      newProject.collaberator_refs.length.should.equal(0)
      newProject.readOnly_refs.length.should.equal(0)
    })

    it('should copy all the folders', async function() {
      await this.ProjectDuplicator.promises.duplicate(
        this.owner,
        this.old_project_id,
        ''
      )
      this.ProjectEntityUpdateHandler.addFolder.should.have.been.calledWith(
        this.new_project_id,
        this.stubbedNewProject.rootFolder[0]._id,
        this.level1folder.name
      )
      this.ProjectEntityUpdateHandler.addFolder.should.have.been.calledWith(
        this.new_project_id,
        this.newFolder._id,
        this.level2folder.name
      )
      this.ProjectEntityUpdateHandler.addFolder.callCount.should.equal(2)
    })

    it('should copy all the docs', async function() {
      await this.ProjectDuplicator.promises.duplicate(
        this.owner,
        this.old_project_id,
        ''
      )
      this.DocstoreManager.promises.getAllDocs.should.have.been.calledWith(
        this.old_project_id
      )
      this.ProjectEntityUpdateHandler.addDoc.should.have.been.calledWith(
        this.new_project_id,
        this.stubbedNewProject.rootFolder[0]._id,
        this.doc0.name,
        this.doc0_lines,
        this.owner._id
      )
      this.ProjectEntityUpdateHandler.addDoc.should.have.been.calledWith(
        this.new_project_id,
        this.newFolder._id,
        this.doc1.name,
        this.doc1_lines,
        this.owner._id
      )
      this.ProjectEntityUpdateHandler.addDoc.should.have.been.calledWith(
        this.new_project_id,
        this.newFolder._id,
        this.doc2.name,
        this.doc2_lines,
        this.owner._id
      )
    })

    it('should copy all the files', async function() {
      await this.ProjectDuplicator.promises.duplicate(
        this.owner,
        this.old_project_id,
        ''
      )
      this.ProjectEntityUpdateHandler.copyFileFromExistingProjectWithProject.should.have.been.calledWith(
        this.stubbedNewProject._id,
        this.stubbedNewProject,
        this.stubbedNewProject.rootFolder[0]._id,
        this.project._id,
        this.rootFolder.fileRefs[0],
        this.owner._id
      )
      this.ProjectEntityUpdateHandler.copyFileFromExistingProjectWithProject.should.have.been.calledWith(
        this.stubbedNewProject._id,
        this.stubbedNewProject,
        this.newFolder._id,
        this.project._id,
        this.level1folder.fileRefs[0],
        this.owner._id
      )
      this.ProjectEntityUpdateHandler.copyFileFromExistingProjectWithProject.should.have.been.calledWith(
        this.stubbedNewProject._id,
        this.stubbedNewProject,
        this.newFolder._id,
        this.project._id,
        this.level2folder.fileRefs[0],
        this.owner._id
      )
    })
  })

  describe('when there is an error', function() {
    beforeEach(async function() {
      this.rootFolder.fileRefs = [
        { name: 'file0', _id: 'file0' },
        'BROKEN-FILE',
        { name: 'file1', _id: 'file1' },
        { name: 'file2', _id: 'file2' }
      ]
      await expect(
        this.ProjectDuplicator.promises.duplicate(
          this.owner,
          this.old_project_id,
          ''
        )
      ).to.be.rejected
    })

    it('should delete the broken cloned project', function() {
      this.ProjectDeleter.promises.deleteProject.should.have.been.calledWith(
        this.stubbedNewProject._id
      )
    })

    it('should not delete the original project', function() {
      this.ProjectDeleter.promises.deleteProject.should.not.have.been.calledWith(
        this.old_project_id
      )
    })
  })
})
