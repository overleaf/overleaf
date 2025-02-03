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
        '../Docstore/DocstoreManager': (this.DocstoreManager = {
          promises: {},
        }),
        '../../Features/DocumentUpdater/DocumentUpdaterHandler':
          this.DocumentUpdaterHandler,
        '../../models/Project': {
          Project: this.ProjectModel,
        },
        './ProjectLocator': this.ProjectLocator,
        './ProjectGetter': (this.ProjectGetter = { promises: {} }),
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
      this.ProjectGetter.promises.getProjectWithoutDocLines = sinon
        .stub()
        .resolves(this.project)
    })

    describe('getAllDocs', function () {
      let fetchedDocs
      beforeEach(async function () {
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
        this.DocstoreManager.promises.getAllDocs = sinon
          .stub()
          .resolves(this.docs)
        fetchedDocs =
          await this.ProjectEntityHandler.promises.getAllDocs(projectId)
      })

      it('should get the doc lines and rev from the docstore', function () {
        this.DocstoreManager.promises.getAllDocs
          .calledWith(projectId)
          .should.equal(true)
      })

      it('should call the callback with the docs with the lines and rev included', function () {
        expect(fetchedDocs).to.deep.equal({
          '/doc1': {
            _id: this.doc1._id,
            lines: this.lines1,
            name: this.doc1.name,
            rev: this.rev1,
            folder: this.project.rootFolder[0],
          },
          '/folder1/doc2': {
            _id: this.doc2._id,
            lines: this.lines2,
            name: this.doc2.name,
            rev: this.rev2,
            folder: this.folder1,
          },
        })
      })
    })

    describe('getAllFiles', function () {
      let allFiles
      beforeEach(async function () {
        this.callback = sinon.stub()
        allFiles = await this.ProjectEntityHandler.promises.getAllFiles(
          projectId,
          this.callback
        )
      })

      it('should call the callback with the files', function () {
        expect(allFiles).to.deep.equal({
          '/file1': { ...this.file1, folder: this.project.rootFolder[0] },
          '/folder1/file2': { ...this.file2, folder: this.folder1 },
        })
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
      })

      it('should call the callback with the path for each docId', function () {
        const expected = {
          [this.doc1._id]: `/${this.doc1.name}`,
          [this.doc2._id]: `/folder1/${this.doc2.name}`,
        }
        expect(
          this.ProjectEntityHandler.getAllDocPathsFromProject(
            this.project,
            this.callback
          )
        ).to.deep.equal(expected)
      })
    })

    describe('getDocPathByProjectIdAndDocId', function () {
      it('should call the callback with the path for an existing doc id at the root level', async function () {
        const path =
          await this.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId(
            projectId,
            this.doc1._id
          )
        expect(path).to.deep.equal(`/${this.doc1.name}`)
      })

      it('should call the callback with the path for an existing doc id nested within a folder', async function () {
        const path =
          await this.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId(
            projectId,
            this.doc2._id
          )
        expect(path).to.deep.equal(`/folder1/${this.doc2.name}`)
      })

      it('should call the callback with a NotFoundError for a non-existing doc', async function () {
        await expect(
          this.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId(
            projectId,
            'non-existing-id'
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })

      it('should call the callback with a NotFoundError for an existing file', async function () {
        await expect(
          this.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId(
            projectId,
            this.file1._id
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })
    })

    describe('_getAllFolders', async function () {
      let folders
      beforeEach(async function () {
        this.callback = sinon.stub()
        folders =
          await this.ProjectEntityHandler.promises._getAllFolders(projectId)
      })

      it('should get the project without the docs lines', function () {
        this.ProjectGetter.promises.getProjectWithoutDocLines
          .calledWith(projectId)
          .should.equal(true)
      })

      it('should call the callback with the folders', function () {
        expect(folders).to.deep.equal([
          { path: '/', folder: this.project.rootFolder[0] },
          { path: '/folder1', folder: this.folder1 },
        ])
      })
    })

    describe('_getAllFoldersFromProject', function () {
      it('should return the folders', function () {
        expect(
          this.ProjectEntityHandler._getAllFoldersFromProject(this.project)
        ).to.deep.equal([
          { path: '/', folder: this.project.rootFolder[0] },
          { path: '/folder1', folder: this.folder1 },
        ])
      })
    })
  })

  describe('with an invalid file tree', function () {
    beforeEach(function () {
      this.project.rootFolder = [
        {
          docs: [
            (this.doc1 = {
              name: null, // invalid doc name
              _id: 'doc1_id',
            }),
          ],
          fileRefs: [
            (this.file1 = {
              rev: 1,
              _id: 'file1_id',
              name: null, // invalid file name
            }),
          ],
          folders: [
            (this.folder1 = {
              name: null, // invalid folder name
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
              folders: null,
            }),
            null, // invalid folder
          ],
        },
      ]
      this.ProjectGetter.promises.getProjectWithoutDocLines = sinon
        .stub()
        .resolves(this.project)
    })

    describe('getAllDocs', function () {
      beforeEach(async function () {
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
        this.DocstoreManager.promises.getAllDocs = sinon
          .stub()
          .resolves(this.docs)
      })

      it('should call the callback with an error', async function () {
        await expect(this.ProjectEntityHandler.promises.getAllDocs(projectId))
          .to.be.rejected
      })
    })

    describe('getAllFiles', function () {
      it('should call the callback with and error', async function () {
        await expect(this.ProjectEntityHandler.promises.getAllFiles(projectId))
          .to.be.rejected
      })
    })

    describe('getDocPathByProjectIdAndDocId', function () {
      it('should call the callback with an error for an existing doc id at the root level', async function () {
        await expect(
          this.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId(
            projectId,
            this.doc1._id
          )
        ).to.be.rejectedWith(Error)
      })

      it('should call the callback with an error for an existing doc id nested within a folder', async function () {
        await expect(
          this.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId(
            projectId,
            this.doc2._id
          )
        ).to.be.rejectedWith(Error)
      })

      it('should call the callback with an error for a non-existing doc', async function () {
        await expect(
          this.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId(
            projectId,
            'non-existing-id'
          )
        ).to.be.rejectedWith(Error)
      })

      it('should call the callback with an error for an existing file', async function () {
        await expect(
          this.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId(
            projectId,
            this.file1._id
          )
        ).to.be.rejectedWith(Error)
      })
    })

    describe('_getAllFolders', function () {
      it('should call the callback with an error', async function () {
        await expect(
          this.ProjectEntityHandler.promises._getAllFolders(projectId)
        ).to.be.rejected
      })
    })

    describe('getAllEntities', function () {
      beforeEach(function () {
        this.ProjectGetter.promises.getProject = sinon
          .stub()
          .resolves(this.project)
      })

      it('should call the callback with an error', async function () {
        await expect(
          this.ProjectEntityHandler.promises.getAllEntities(projectId)
        ).to.be.rejected
      })
    })

    describe('getAllDocPathsFromProjectById', function () {
      it('should call the callback with an error', async function () {
        await expect(
          this.ProjectEntityHandler.promises.getAllDocPathsFromProjectById(
            projectId
          )
        ).to.be.rejected
      })
    })

    describe('getDocPathFromProjectByDocId', function () {
      it('should call the callback with an error', async function () {
        await expect(
          this.ProjectEntityHandler.promises.getDocPathFromProjectByDocId(
            projectId,
            this.doc1._id
          )
        ).to.be.rejected
      })
    })
  })

  describe('getDoc', function () {
    beforeEach(function () {
      this.lines = ['mock', 'doc', 'lines']
      this.rev = 5
      this.version = 42
      this.ranges = { mock: 'ranges' }
      this.callback = sinon.stub()
      this.DocstoreManager.promises.getDoc = sinon.stub().resolves({
        lines: this.lines,
        rev: this.rev,
        version: this.version,
        ranges: this.ranges,
      })
    })

    it('should call the callback with the lines, version and rev', function (done) {
      this.ProjectEntityHandler.getDoc(projectId, docId, doc => {
        this.DocstoreManager.promises.getDoc
          .calledWith(projectId, docId)
          .should.equal(true)
        expect(doc).to.exist
        done()
      })
    })
  })

  describe('promises.getDoc', function () {
    let result

    beforeEach(async function () {
      this.lines = ['mock', 'doc', 'lines']
      this.rev = 5
      this.version = 42
      this.ranges = { mock: 'ranges' }

      this.DocstoreManager.promises.getDoc = sinon.stub().resolves({
        lines: this.lines,
        rev: this.rev,
        version: this.version,
        ranges: this.ranges,
      })
      result = await this.ProjectEntityHandler.promises.getDoc(projectId, docId)
    })

    it('should call the docstore', function () {
      this.DocstoreManager.promises.getDoc
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
