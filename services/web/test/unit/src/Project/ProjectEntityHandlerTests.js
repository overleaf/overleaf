const { expect } = require('chai')
const sinon = require('sinon')
const modulePath = '../../../../app/src/Features/Project/ProjectEntityHandler'
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/src/Features/Errors/Errors')

describe('ProjectEntityHandler', function () {
  const projectId = '4eecb1c1bffa66588e0000a1'
  const docId = '4eecb1c1bffa66588e0000a2'

  beforeEach(function () {
    this.TpdsUpdateSender = {
      addDoc: sinon.stub().callsArg(1),
      addFile: sinon.stub().callsArg(1),
    }
    this.ProjectModel = class Project {
      constructor(options) {
        this._id = projectId
        this.name = 'project_name_here'
        this.rev = 0
        this.rootFolder = [this.rootFolder]
      }
    }
    this.project = new this.ProjectModel()

    this.ProjectLocator = { findElement: sinon.stub() }
    this.DocumentUpdaterHandler = {
      updateProjectStructure: sinon.stub().yields(),
    }
    this.callback = sinon.stub()

    this.ProjectEntityHandler = SandboxedModule.require(modulePath, {
      requires: {
        '../Docstore/DocstoreManager': (this.DocstoreManager = {}),
        '../../Features/DocumentUpdater/DocumentUpdaterHandler': this
          .DocumentUpdaterHandler,
        '../../models/Project': {
          Project: this.ProjectModel,
        },
        './ProjectLocator': this.ProjectLocator,
        './ProjectGetter': (this.ProjectGetter = {}),
        '../ThirdPartyDataStore/TpdsUpdateSender': this.TpdsUpdateSender,
      },
    })
  })

  describe('getting folders, docs and files', function () {
    beforeEach(function () {
      this.project.rootFolder = [
        {
          docs: [
            (this.doc1 = {
              name: 'doc1',
              _id: 'doc1_id',
            }),
          ],
          fileRefs: [
            (this.file1 = {
              rev: 1,
              _id: 'file1_id',
              name: 'file1',
            }),
          ],
          folders: [
            (this.folder1 = {
              name: 'folder1',
              docs: [
                (this.doc2 = {
                  name: 'doc2',
                  _id: 'doc2_id',
                }),
              ],
              fileRefs: [
                (this.file2 = {
                  rev: 2,
                  name: 'file2',
                  _id: 'file2_id',
                }),
              ],
              folders: [],
            }),
          ],
        },
      ]
      this.ProjectGetter.getProjectWithoutDocLines = sinon
        .stub()
        .yields(null, this.project)
    })

    describe('getAllDocs', function () {
      beforeEach(function () {
        this.docs = [
          {
            _id: this.doc1._id,
            lines: (this.lines1 = ['one']),
            rev: (this.rev1 = 1),
          },
          {
            _id: this.doc2._id,
            lines: (this.lines2 = ['two']),
            rev: (this.rev2 = 2),
          },
        ]
        this.DocstoreManager.getAllDocs = sinon
          .stub()
          .callsArgWith(1, null, this.docs)
        this.ProjectEntityHandler.getAllDocs(projectId, this.callback)
      })

      it('should get the doc lines and rev from the docstore', function () {
        this.DocstoreManager.getAllDocs.calledWith(projectId).should.equal(true)
      })

      it('should call the callback with the docs with the lines and rev included', function () {
        this.callback
          .calledWith(null, {
            '/doc1': {
              _id: this.doc1._id,
              lines: this.lines1,
              name: this.doc1.name,
              rev: this.rev1,
            },
            '/folder1/doc2': {
              _id: this.doc2._id,
              lines: this.lines2,
              name: this.doc2.name,
              rev: this.rev2,
            },
          })
          .should.equal(true)
      })
    })

    describe('getAllFiles', function () {
      beforeEach(function () {
        this.callback = sinon.stub()
        this.ProjectEntityHandler.getAllFiles(projectId, this.callback)
      })

      it('should call the callback with the files', function () {
        this.callback
          .calledWith(null, {
            '/file1': this.file1,
            '/folder1/file2': this.file2,
          })
          .should.equal(true)
      })
    })

    describe('getAllDocPathsFromProject', function () {
      beforeEach(function () {
        this.docs = [
          {
            _id: this.doc1._id,
            lines: (this.lines1 = ['one']),
            rev: (this.rev1 = 1),
          },
          {
            _id: this.doc2._id,
            lines: (this.lines2 = ['two']),
            rev: (this.rev2 = 2),
          },
        ]
        this.callback = sinon.stub()
        this.ProjectEntityHandler.getAllDocPathsFromProject(
          this.project,
          this.callback
        )
      })

      it('should call the callback with the path for each docId', function () {
        this.expected = {}
        this.expected[this.doc1._id] = `/${this.doc1.name}`
        this.expected[this.doc2._id] = `/folder1/${this.doc2.name}`
        this.callback.calledWith(null, this.expected).should.equal(true)
      })
    })

    describe('getDocPathByProjectIdAndDocId', function () {
      beforeEach(function () {
        this.callback = sinon.stub()
      })
      it('should call the callback with the path for an existing doc id at the root level', function () {
        this.ProjectEntityHandler.getDocPathByProjectIdAndDocId(
          projectId,
          this.doc1._id,
          this.callback
        )
        this.callback.calledWith(null, `/${this.doc1.name}`).should.equal(true)
      })

      it('should call the callback with the path for an existing doc id nested within a folder', function () {
        this.ProjectEntityHandler.getDocPathByProjectIdAndDocId(
          projectId,
          this.doc2._id,
          this.callback
        )
        this.callback
          .calledWith(null, `/folder1/${this.doc2.name}`)
          .should.equal(true)
      })

      it('should call the callback with a NotFoundError for a non-existing doc', function () {
        this.ProjectEntityHandler.getDocPathByProjectIdAndDocId(
          projectId,
          'non-existing-id',
          this.callback
        )
        expect(this.callback.firstCall.args[0]).to.be.an.instanceof(
          Errors.NotFoundError
        )
      })

      it('should call the callback with a NotFoundError for an existing file', function () {
        this.ProjectEntityHandler.getDocPathByProjectIdAndDocId(
          projectId,
          this.file1._id,
          this.callback
        )
        expect(this.callback.firstCall.args[0]).to.be.an.instanceof(
          Errors.NotFoundError
        )
      })
    })

    describe('_getAllFolders', function () {
      beforeEach(function () {
        this.callback = sinon.stub()
        this.ProjectEntityHandler._getAllFolders(projectId, this.callback)
      })

      it('should get the project without the docs lines', function () {
        this.ProjectGetter.getProjectWithoutDocLines
          .calledWith(projectId)
          .should.equal(true)
      })

      it('should call the callback with the folders', function () {
        this.callback
          .calledWith(null, [
            { path: '/', folder: this.project.rootFolder[0] },
            { path: '/folder1', folder: this.folder1 },
          ])
          .should.equal(true)
      })
    })

    describe('_getAllFoldersFromProject', function () {
      beforeEach(function () {
        this.callback = sinon.stub()
        this.ProjectEntityHandler._getAllFoldersFromProject(
          this.project,
          this.callback
        )
      })

      it('should call the callback with the folders', function () {
        this.callback
          .calledWith(null, [
            { path: '/', folder: this.project.rootFolder[0] },
            { path: '/folder1', folder: this.folder1 },
          ])
          .should.equal(true)
      })
    })
  })

  describe('getDoc', function () {
    beforeEach(function () {
      this.lines = ['mock', 'doc', 'lines']
      this.rev = 5
      this.version = 42
      this.ranges = { mock: 'ranges' }

      this.DocstoreManager.getDoc = sinon
        .stub()
        .callsArgWith(3, null, this.lines, this.rev, this.version, this.ranges)
      this.ProjectEntityHandler.getDoc(projectId, docId, this.callback)
    })

    it('should call the docstore', function () {
      this.DocstoreManager.getDoc
        .calledWith(projectId, docId)
        .should.equal(true)
    })

    it('should call the callback with the lines, version and rev', function () {
      this.callback
        .calledWith(null, this.lines, this.rev, this.version, this.ranges)
        .should.equal(true)
    })
  })

  describe('promises.getDoc', function () {
    let result

    beforeEach(async function () {
      this.lines = ['mock', 'doc', 'lines']
      this.rev = 5
      this.version = 42
      this.ranges = { mock: 'ranges' }

      this.DocstoreManager.getDoc = sinon
        .stub()
        .callsArgWith(3, null, this.lines, this.rev, this.version, this.ranges)
      result = await this.ProjectEntityHandler.promises.getDoc(projectId, docId)
    })

    it('should call the docstore', function () {
      this.DocstoreManager.getDoc
        .calledWith(projectId, docId)
        .should.equal(true)
    })

    it('should return the lines, rev, version and ranges', function () {
      expect(result.lines).to.equal(this.lines)
      expect(result.rev).to.equal(this.rev)
      expect(result.version).to.equal(this.version)
      expect(result.ranges).to.equal(this.ranges)
    })
  })
})
