/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const chai = require('chai')
const { assert } = require('chai')
const should = chai.should()
const { expect } = chai
const sinon = require('sinon')
const modulePath = '../../../../app/src/Features/Project/ProjectEntityHandler'
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongoose').Types
const Errors = require('../../../../app/src/Features/Errors/Errors')

describe('ProjectEntityHandler', function() {
  const project_id = '4eecb1c1bffa66588e0000a1'
  const doc_id = '4eecb1c1bffa66588e0000a2'
  const folder_id = '4eecaffcbffa66588e000008'
  const rootFolderId = '4eecaffcbffa66588e000007'
  const userId = 1234

  beforeEach(function() {
    let Project
    this.TpdsUpdateSender = {
      addDoc: sinon.stub().callsArg(1),
      addFile: sinon.stub().callsArg(1)
    }
    this.ProjectModel = Project = (function() {
      Project = class Project {
        static initClass() {
          this.prototype.rootFolder = [this.rootFolder]
        }
        constructor(options) {
          this._id = project_id
          this.name = 'project_name_here'
          this.rev = 0
        }
      }
      Project.initClass()
      return Project
    })()

    this.project = new this.ProjectModel()

    this.ProjectLocator = { findElement: sinon.stub() }
    this.DocumentUpdaterHandler = {
      updateProjectStructure: sinon.stub().yields()
    }

    this.callback = sinon.stub()

    return (this.ProjectEntityHandler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          error: sinon.stub(),
          err() {}
        }),
        '../Docstore/DocstoreManager': (this.DocstoreManager = {}),
        '../../Features/DocumentUpdater/DocumentUpdaterHandler': this
          .DocumentUpdaterHandler,
        '../../models/Project': {
          Project: this.ProjectModel
        },
        './ProjectLocator': this.ProjectLocator,
        './ProjectGetter': (this.ProjectGetter = {}),
        '../ThirdPartyDataStore/TpdsUpdateSender': this.TpdsUpdateSender
      }
    }))
  })

  describe('getting folders, docs and files', function() {
    beforeEach(function() {
      this.project.rootFolder = [
        {
          docs: [
            (this.doc1 = {
              name: 'doc1',
              _id: 'doc1_id'
            })
          ],
          fileRefs: [
            (this.file1 = {
              rev: 1,
              _id: 'file1_id',
              name: 'file1'
            })
          ],
          folders: [
            (this.folder1 = {
              name: 'folder1',
              docs: [
                (this.doc2 = {
                  name: 'doc2',
                  _id: 'doc2_id'
                })
              ],
              fileRefs: [
                (this.file2 = {
                  rev: 2,
                  name: 'file2',
                  _id: 'file2_id'
                })
              ],
              folders: []
            })
          ]
        }
      ]
      return (this.ProjectGetter.getProjectWithoutDocLines = sinon
        .stub()
        .yields(null, this.project))
    })

    describe('getAllDocs', function() {
      beforeEach(function() {
        this.docs = [
          {
            _id: this.doc1._id,
            lines: (this.lines1 = ['one']),
            rev: (this.rev1 = 1)
          },
          {
            _id: this.doc2._id,
            lines: (this.lines2 = ['two']),
            rev: (this.rev2 = 2)
          }
        ]
        this.DocstoreManager.getAllDocs = sinon
          .stub()
          .callsArgWith(1, null, this.docs)
        return this.ProjectEntityHandler.getAllDocs(project_id, this.callback)
      })

      it('should get the doc lines and rev from the docstore', function() {
        return this.DocstoreManager.getAllDocs
          .calledWith(project_id)
          .should.equal(true)
      })

      it('should call the callback with the docs with the lines and rev included', function() {
        return this.callback
          .calledWith(null, {
            '/doc1': {
              _id: this.doc1._id,
              lines: this.lines1,
              name: this.doc1.name,
              rev: this.rev1
            },
            '/folder1/doc2': {
              _id: this.doc2._id,
              lines: this.lines2,
              name: this.doc2.name,
              rev: this.rev2
            }
          })
          .should.equal(true)
      })
    })

    describe('getAllFiles', function() {
      beforeEach(function() {
        this.callback = sinon.stub()
        return this.ProjectEntityHandler.getAllFiles(project_id, this.callback)
      })

      it('should call the callback with the files', function() {
        return this.callback
          .calledWith(null, {
            '/file1': this.file1,
            '/folder1/file2': this.file2
          })
          .should.equal(true)
      })
    })

    describe('getAllDocPathsFromProject', function() {
      beforeEach(function() {
        this.docs = [
          {
            _id: this.doc1._id,
            lines: (this.lines1 = ['one']),
            rev: (this.rev1 = 1)
          },
          {
            _id: this.doc2._id,
            lines: (this.lines2 = ['two']),
            rev: (this.rev2 = 2)
          }
        ]
        this.callback = sinon.stub()
        return this.ProjectEntityHandler.getAllDocPathsFromProject(
          this.project,
          this.callback
        )
      })

      it('should call the callback with the path for each doc_id', function() {
        this.expected = {}
        this.expected[this.doc1._id] = `/${this.doc1.name}`
        this.expected[this.doc2._id] = `/folder1/${this.doc2.name}`
        return this.callback.calledWith(null, this.expected).should.equal(true)
      })
    })

    describe('_getAllFolders', function() {
      beforeEach(function() {
        this.callback = sinon.stub()
        return this.ProjectEntityHandler._getAllFolders(
          project_id,
          this.callback
        )
      })

      it('should get the project without the docs lines', function() {
        return this.ProjectGetter.getProjectWithoutDocLines
          .calledWith(project_id)
          .should.equal(true)
      })

      it('should call the callback with the folders', function() {
        return this.callback
          .calledWith(null, {
            '/': this.project.rootFolder[0],
            '/folder1': this.folder1
          })
          .should.equal(true)
      })
    })

    describe('_getAllFoldersFromProject', function() {
      beforeEach(function() {
        this.callback = sinon.stub()
        return this.ProjectEntityHandler._getAllFoldersFromProject(
          this.project,
          this.callback
        )
      })

      it('should call the callback with the folders', function() {
        return this.callback
          .calledWith(null, {
            '/': this.project.rootFolder[0],
            '/folder1': this.folder1
          })
          .should.equal(true)
      })
    })
  })

  describe('flushProjectToThirdPartyDataStore', function() {
    beforeEach(function(done) {
      this.project = {
        _id: project_id,
        name: 'Mock project name'
      }
      this.DocumentUpdaterHandler.flushProjectToMongo = sinon.stub().yields()
      this.docs = {
        '/doc/one': (this.doc1 = { _id: 'mock-doc-1', lines: ['one'], rev: 5 }),
        '/doc/two': (this.doc2 = { _id: 'mock-doc-2', lines: ['two'], rev: 6 })
      }
      this.files = {
        '/file/one': (this.file1 = { _id: 'mock-file-1', rev: 7 }),
        '/file/two': (this.file2 = { _id: 'mock-file-2', rev: 8 })
      }
      this.ProjectEntityHandler.getAllDocs = sinon
        .stub()
        .yields(null, this.docs)
      this.ProjectEntityHandler.getAllFiles = sinon
        .stub()
        .yields(null, this.files)

      this.ProjectGetter.getProject = sinon.stub().yields(null, this.project)

      return this.ProjectEntityHandler.flushProjectToThirdPartyDataStore(
        project_id,
        () => done()
      )
    })

    it('should flush the project from the doc updater', function() {
      return this.DocumentUpdaterHandler.flushProjectToMongo
        .calledWith(project_id)
        .should.equal(true)
    })

    it('should look up the project in mongo', function() {
      return this.ProjectGetter.getProject
        .calledWith(project_id)
        .should.equal(true)
    })

    it('should get all the docs in the project', function() {
      return this.ProjectEntityHandler.getAllDocs
        .calledWith(project_id)
        .should.equal(true)
    })

    it('should get all the files in the project', function() {
      return this.ProjectEntityHandler.getAllFiles
        .calledWith(project_id)
        .should.equal(true)
    })

    it('should flush each doc to the TPDS', function() {
      return (() => {
        const result = []
        for (let path in this.docs) {
          const doc = this.docs[path]
          result.push(
            this.TpdsUpdateSender.addDoc
              .calledWith({
                project_id,
                doc_id: doc._id,
                project_name: this.project.name,
                rev: doc.rev,
                path
              })
              .should.equal(true)
          )
        }
        return result
      })()
    })

    it('should flush each file to the TPDS', function() {
      return (() => {
        const result = []
        for (let path in this.files) {
          const file = this.files[path]
          result.push(
            this.TpdsUpdateSender.addFile
              .calledWith({
                project_id,
                file_id: file._id,
                project_name: this.project.name,
                rev: file.rev,
                path
              })
              .should.equal(true)
          )
        }
        return result
      })()
    })
  })

  describe('getDoc', function() {
    beforeEach(function() {
      this.lines = ['mock', 'doc', 'lines']
      this.rev = 5
      this.version = 42
      this.ranges = { mock: 'ranges' }

      this.DocstoreManager.getDoc = sinon
        .stub()
        .callsArgWith(3, null, this.lines, this.rev, this.version, this.ranges)
      return this.ProjectEntityHandler.getDoc(project_id, doc_id, this.callback)
    })

    it('should call the docstore', function() {
      return this.DocstoreManager.getDoc
        .calledWith(project_id, doc_id)
        .should.equal(true)
    })

    it('should call the callback with the lines, version and rev', function() {
      return this.callback
        .calledWith(null, this.lines, this.rev, this.version, this.ranges)
        .should.equal(true)
    })
  })
})
