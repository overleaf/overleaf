/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai').should()
const modulePath = '../../../../app/src/Features/Project/ProjectDuplicator.js'
const SandboxedModule = require('sandboxed-module')

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
      getAllDocs: sinon.stub().callsArgWith(1, null, this.docContents)
    }

    this.owner = { _id: 'this_is_the_owner' }
    this.stubbedNewProject = {
      _id: (this.new_project_id = 'new_project_id'),
      readOnly_refs: [],
      collaberator_refs: [],
      rootFolder: [{ _id: 'new_root_folder_id' }]
    }
    this.foundRootDoc = { _id: 'rootDocId', name: 'rootDocHere' }

    this.creationHandler = {
      createBlankProject: sinon
        .stub()
        .callsArgWith(2, null, this.stubbedNewProject)
    }

    this.newFolder = { _id: 'newFolderId' }

    this.locator = {
      findRootDoc: sinon.stub().callsArgWith(1, null, this.foundRootDoc, {})
    }

    this.projectOptionsHandler = { setCompiler: sinon.stub().callsArg(2) }
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
      flushProjectToMongo: sinon.stub().callsArg(1)
    }

    this.Project = {
      findById: sinon.stub().callsArgWith(1, null, this.project)
    }

    this.ProjectGetter = { getProject: sinon.stub() }

    this.ProjectGetter.getProject
      .withArgs(this.old_project_id, sinon.match.any)
      .callsArgWith(2, null, this.project)
    this.ProjectGetter.getProject
      .withArgs(this.new_project_id, sinon.match.any)
      .callsArgWith(2, null, this.stubbedNewProject)

    this.ProjectDeleter = { deleteProject: sinon.stub().callsArgWith(1, null) }

    return (this.duplicator = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../../models/Project': { Project: this.Project },
        '../DocumentUpdater/DocumentUpdaterHandler': this
          .DocumentUpdaterHandler,
        './ProjectCreationHandler': this.creationHandler,
        './ProjectEntityUpdateHandler': this.ProjectEntityUpdateHandler,
        './ProjectLocator': this.locator,
        './ProjectDeleter': this.ProjectDeleter,
        './ProjectOptionsHandler': this.projectOptionsHandler,
        '../Docstore/DocstoreManager': this.DocstoreManager,
        './ProjectGetter': this.ProjectGetter,
        'logger-sharelatex': {
          log() {},
          warn() {},
          err() {}
        }
      }
    }))
  })

  describe('when the copy succeeds', function() {
    it('should look up the original project', function(done) {
      const newProjectName = 'someProj'
      return this.duplicator.duplicate(
        this.owner,
        this.old_project_id,
        newProjectName,
        (err, newProject) => {
          this.ProjectGetter.getProject
            .calledWith(this.old_project_id)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should flush the original project to mongo', function(done) {
      const newProjectName = 'someProj'
      return this.duplicator.duplicate(
        this.owner,
        this.old_project_id,
        newProjectName,
        (err, newProject) => {
          this.DocumentUpdaterHandler.flushProjectToMongo
            .calledWith(this.old_project_id)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should create a blank project', function(done) {
      const newProjectName = 'someProj'
      return this.duplicator.duplicate(
        this.owner,
        this.old_project_id,
        newProjectName,
        (err, newProject) => {
          newProject._id.should.equal(this.stubbedNewProject._id)
          this.creationHandler.createBlankProject
            .calledWith(this.owner._id, newProjectName)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should use the same compiler', function(done) {
      this.ProjectEntityUpdateHandler.addDoc.callsArgWith(
        5,
        null,
        this.rootFolder.docs[0],
        this.owner._id
      )
      return this.duplicator.duplicate(
        this.owner,
        this.old_project_id,
        '',
        (err, newProject) => {
          this.projectOptionsHandler.setCompiler
            .calledWith(this.stubbedNewProject._id, this.project.compiler)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should use the same root doc', function(done) {
      this.ProjectEntityUpdateHandler.addDoc.callsArgWith(
        5,
        null,
        this.rootFolder.docs[0],
        this.owner._id
      )
      return this.duplicator.duplicate(
        this.owner,
        this.old_project_id,
        '',
        (err, newProject) => {
          this.ProjectEntityUpdateHandler.setRootDoc
            .calledWith(this.stubbedNewProject._id, this.rootFolder.docs[0]._id)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should not copy the collaberators or read only refs', function(done) {
      return this.duplicator.duplicate(
        this.owner,
        this.old_project_id,
        '',
        (err, newProject) => {
          newProject.collaberator_refs.length.should.equal(0)
          newProject.readOnly_refs.length.should.equal(0)
          return done()
        }
      )
    })

    it('should copy all the folders', function(done) {
      return this.duplicator.duplicate(
        this.owner,
        this.old_project_id,
        '',
        (err, newProject) => {
          this.ProjectEntityUpdateHandler.addFolder
            .calledWith(
              this.new_project_id,
              this.stubbedNewProject.rootFolder[0]._id,
              this.level1folder.name
            )
            .should.equal(true)
          this.ProjectEntityUpdateHandler.addFolder
            .calledWith(
              this.new_project_id,
              this.newFolder._id,
              this.level2folder.name
            )
            .should.equal(true)
          this.ProjectEntityUpdateHandler.addFolder.callCount.should.equal(2)
          return done()
        }
      )
    })

    it('should copy all the docs', function(done) {
      return this.duplicator.duplicate(
        this.owner,
        this.old_project_id,
        '',
        (err, newProject) => {
          this.DocstoreManager.getAllDocs
            .calledWith(this.old_project_id)
            .should.equal(true)
          this.ProjectEntityUpdateHandler.addDoc
            .calledWith(
              this.new_project_id,
              this.stubbedNewProject.rootFolder[0]._id,
              this.doc0.name,
              this.doc0_lines,
              this.owner._id
            )
            .should.equal(true)
          this.ProjectEntityUpdateHandler.addDoc
            .calledWith(
              this.new_project_id,
              this.newFolder._id,
              this.doc1.name,
              this.doc1_lines,
              this.owner._id
            )
            .should.equal(true)
          this.ProjectEntityUpdateHandler.addDoc
            .calledWith(
              this.new_project_id,
              this.newFolder._id,
              this.doc2.name,
              this.doc2_lines,
              this.owner._id
            )
            .should.equal(true)
          return done()
        }
      )
    })

    it('should copy all the files', function(done) {
      return this.duplicator.duplicate(
        this.owner,
        this.old_project_id,
        '',
        (err, newProject) => {
          this.ProjectEntityUpdateHandler.copyFileFromExistingProjectWithProject
            .calledWith(
              this.stubbedNewProject._id,
              this.stubbedNewProject,
              this.stubbedNewProject.rootFolder[0]._id,
              this.project._id,
              this.rootFolder.fileRefs[0],
              this.owner._id
            )
            .should.equal(true)
          this.ProjectEntityUpdateHandler.copyFileFromExistingProjectWithProject
            .calledWith(
              this.stubbedNewProject._id,
              this.stubbedNewProject,
              this.newFolder._id,
              this.project._id,
              this.level1folder.fileRefs[0],
              this.owner._id
            )
            .should.equal(true)
          this.ProjectEntityUpdateHandler.copyFileFromExistingProjectWithProject
            .calledWith(
              this.stubbedNewProject._id,
              this.stubbedNewProject,
              this.newFolder._id,
              this.project._id,
              this.level2folder.fileRefs[0],
              this.owner._id
            )
            .should.equal(true)
          return done()
        }
      )
    })
  })

  describe('when there is an error', function() {
    beforeEach(function() {
      return (this.rootFolder.fileRefs = [
        { name: 'file0', _id: 'file0' },
        'BROKEN-FILE',
        { name: 'file1', _id: 'file1' },
        { name: 'file2', _id: 'file2' }
      ])
    })

    it('should delete the broken cloned project', function(done) {
      return this.duplicator.duplicate(
        this.owner,
        this.old_project_id,
        '',
        (err, newProject) => {
          this.ProjectDeleter.deleteProject
            .calledWith(this.stubbedNewProject._id)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should not delete the original project', function(done) {
      return this.duplicator.duplicate(
        this.owner,
        this.old_project_id,
        '',
        (err, newProject) => {
          this.ProjectDeleter.deleteProject
            .calledWith(this.old_project_id)
            .should.equal(false)
          return done()
        }
      )
    })

    it('should return an error', function(done) {
      return this.duplicator.duplicate(
        this.owner,
        this.old_project_id,
        '',
        (err, newProject) => {
          err.should.not.equal(null)
          return done()
        }
      )
    })
  })
})
