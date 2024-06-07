const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/History/RestoreManager'
)
const Errors = require('../../../../app/src/Features/Errors/Errors')
const tk = require('timekeeper')
const moment = require('moment')
const { expect } = require('chai')

describe('RestoreManager', function () {
  beforeEach(function () {
    tk.freeze(Date.now()) // freeze the time for these tests
    this.RestoreManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': {},
        '../../infrastructure/FileWriter': (this.FileWriter = { promises: {} }),
        '../Uploads/FileSystemImportManager': (this.FileSystemImportManager = {
          promises: {},
        }),
        '../Editor/EditorController': (this.EditorController = {
          promises: {},
        }),
        '../Project/ProjectLocator': (this.ProjectLocator = { promises: {} }),
        '../DocumentUpdater/DocumentUpdaterHandler':
          (this.DocumentUpdaterHandler = { promises: {} }),
      },
    })
    this.user_id = 'mock-user-id'
    this.project_id = 'mock-project-id'
    this.version = 42
  })

  afterEach(function () {
    tk.reset()
  })

  describe('restoreFileFromV2', function () {
    beforeEach(function () {
      this.RestoreManager.promises._writeFileVersionToDisk = sinon
        .stub()
        .resolves((this.fsPath = '/tmp/path/on/disk'))
      this.RestoreManager.promises._findOrCreateFolder = sinon
        .stub()
        .resolves((this.folder_id = 'mock-folder-id'))
      this.FileSystemImportManager.promises.addEntity = sinon
        .stub()
        .resolves((this.entity = 'mock-entity'))
    })

    describe('with a file not in a folder', function () {
      beforeEach(async function () {
        this.pathname = 'foo.tex'
        this.result = await this.RestoreManager.promises.restoreFileFromV2(
          this.user_id,
          this.project_id,
          this.version,
          this.pathname
        )
      })

      it('should write the file version to disk', function () {
        this.RestoreManager.promises._writeFileVersionToDisk
          .calledWith(this.project_id, this.version, this.pathname)
          .should.equal(true)
      })

      it('should find the root folder', function () {
        this.RestoreManager.promises._findOrCreateFolder
          .calledWith(this.project_id, '')
          .should.equal(true)
      })

      it('should add the entity', function () {
        this.FileSystemImportManager.promises.addEntity
          .calledWith(
            this.user_id,
            this.project_id,
            this.folder_id,
            'foo.tex',
            this.fsPath,
            false
          )
          .should.equal(true)
      })

      it('should return the entity', function () {
        expect(this.result).to.equal(this.entity)
      })
    })

    describe('with a file in a folder', function () {
      beforeEach(async function () {
        this.pathname = 'foo/bar.tex'
        await this.RestoreManager.promises.restoreFileFromV2(
          this.user_id,
          this.project_id,
          this.version,
          this.pathname
        )
      })

      it('should find the folder', function () {
        this.RestoreManager.promises._findOrCreateFolder
          .calledWith(this.project_id, 'foo')
          .should.equal(true)
      })

      it('should add the entity by its basename', function () {
        this.FileSystemImportManager.promises.addEntity
          .calledWith(
            this.user_id,
            this.project_id,
            this.folder_id,
            'bar.tex',
            this.fsPath,
            false
          )
          .should.equal(true)
      })
    })
  })

  describe('_findOrCreateFolder', function () {
    beforeEach(async function () {
      this.EditorController.promises.mkdirp = sinon.stub().resolves({
        newFolders: [],
        lastFolder: { _id: (this.folder_id = 'mock-folder-id') },
      })
      this.result = await this.RestoreManager.promises._findOrCreateFolder(
        this.project_id,
        'folder/name'
      )
    })

    it('should look up or create the folder', function () {
      this.EditorController.promises.mkdirp
        .calledWith(this.project_id, 'folder/name')
        .should.equal(true)
    })

    it('should return the folder_id', function () {
      expect(this.result).to.equal(this.folder_id)
    })
  })

  describe('_addEntityWithUniqueName', function () {
    beforeEach(function () {
      this.addEntityWithName = sinon.stub()
      this.name = 'foo.tex'
    })

    describe('with a valid name', function () {
      beforeEach(async function () {
        this.addEntityWithName.resolves((this.entity = 'mock-entity'))
        this.result =
          await this.RestoreManager.promises._addEntityWithUniqueName(
            this.addEntityWithName,
            this.name
          )
      })

      it('should add the entity', function () {
        this.addEntityWithName.calledWith(this.name).should.equal(true)
      })

      it('should return the entity', function () {
        expect(this.result).to.equal(this.entity)
      })
    })

    describe('with an invalid name', function () {
      beforeEach(async function () {
        this.addEntityWithName.rejects(new Errors.InvalidNameError())
        this.addEntityWithName
          .onSecondCall()
          .resolves((this.entity = 'mock-entity'))
        this.result =
          await this.RestoreManager.promises._addEntityWithUniqueName(
            this.addEntityWithName,
            this.name
          )
      })

      it('should try to add the entity with its original name', function () {
        this.addEntityWithName.calledWith('foo.tex').should.equal(true)
      })

      it('should try to add the entity with a unique name', function () {
        const date = moment(new Date()).format('Do MMM YY H:mm:ss')
        this.addEntityWithName
          .calledWith(`foo (Restored on ${date}).tex`)
          .should.equal(true)
      })

      it('should return the entity', function () {
        expect(this.result).to.equal(this.entity)
      })
    })
  })

  describe('revertFile', function () {
    beforeEach(function () {
      this.RestoreManager.promises._writeFileVersionToDisk = sinon
        .stub()
        .resolves((this.fsPath = '/tmp/path/on/disk'))
      this.RestoreManager.promises._findOrCreateFolder = sinon
        .stub()
        .resolves((this.folder_id = 'mock-folder-id'))
      this.FileSystemImportManager.promises.addEntity = sinon
        .stub()
        .resolves((this.entity = 'mock-entity'))
      this.RestoreManager.promises._getRangesFromHistory = sinon
        .stub()
        .rejects()
    })

    describe('with an existing file in the current project', function () {
      beforeEach(function () {
        this.pathname = 'foo.tex'
        this.FileSystemImportManager.promises.importFile = sinon
          .stub()
          .resolves({ type: 'doc' })
        this.ProjectLocator.promises.findElementByPath = sinon
          .stub()
          .resolves({ type: 'doc', element: { _id: 'mock-file-id' } })
        this.FileSystemImportManager.promises.importFile = sinon
          .stub()
          .resolves({ type: 'doc', lines: ['foo', 'bar', 'baz'] })
        this.DocumentUpdaterHandler.promises.setDocument = sinon
          .stub()
          .resolves()
      })

      it('should call setDocument in document updater and revert file', async function () {
        const revertRes = await this.RestoreManager.promises.revertFile(
          this.user_id,
          this.project_id,
          this.version,
          this.pathname
        )

        expect(
          this.DocumentUpdaterHandler.promises.setDocument
        ).to.have.been.calledWith(
          this.project_id,
          'mock-file-id',
          this.user_id,
          ['foo', 'bar', 'baz'],
          'file-revert'
        )
        expect(revertRes).to.deep.equal({ _id: 'mock-file-id', type: 'doc' })
      })
    })

    describe('when reverting a binary file', function () {
      beforeEach(async function () {
        this.pathname = 'foo.png'
        this.FileSystemImportManager.promises.importFile = sinon
          .stub()
          .resolves({ type: 'file' })
        this.EditorController.promises.upsertFile = sinon
          .stub()
          .resolves({ _id: 'mock-file-id', type: 'file' })
      })

      it('should return the created entity if file exists', async function () {
        this.ProjectLocator.promises.findElementByPath = sinon
          .stub()
          .resolves({ type: 'file' })

        const revertRes = await this.RestoreManager.promises.revertFile(
          this.user_id,
          this.project_id,
          this.version,
          this.pathname
        )

        expect(revertRes).to.deep.equal({ _id: 'mock-file-id', type: 'file' })
      })

      it('should return the created entity if file does not exists', async function () {
        this.ProjectLocator.promises.findElementByPath = sinon.stub().rejects()

        const revertRes = await this.RestoreManager.promises.revertFile(
          this.user_id,
          this.project_id,
          this.version,
          this.pathname
        )

        expect(revertRes).to.deep.equal({ _id: 'mock-file-id', type: 'file' })
      })
    })

    describe("when reverting a file that doesn't current exist", function () {
      beforeEach(async function () {
        this.pathname = 'foo.tex'
        this.ProjectLocator.promises.findElementByPath = sinon.stub().rejects()
        this.tracked_changes = [
          {
            op: { pos: 4, i: 'bar' },
            metadata: { ts: '2024-01-01T00:00:00.000Z', user_id: 'user-1' },
          },
          {
            op: { pos: 8, d: 'qux' },
            metadata: { ts: '2024-01-01T00:00:00.000Z', user_id: 'user-2' },
          },
        ]
        this.comments = [{ op: { t: 'comment-1', p: 0, c: 'foo' } }]
        this.FileSystemImportManager.promises.importFile = sinon
          .stub()
          .resolves({ type: 'doc', lines: ['foo', 'bar', 'baz'] })
        this.RestoreManager.promises._getRangesFromHistory = sinon
          .stub()
          .resolves({ changes: this.tracked_changes, comment: this.comments })
        this.EditorController.promises.addDocWithRanges = sinon
          .stub()
          .resolves(
            (this.addedFile = { doc: 'mock-doc', folderId: 'mock-folder' })
          )
        this.data = await this.RestoreManager.promises.revertFile(
          this.user_id,
          this.project_id,
          this.version,
          this.pathname
        )
      })

      it('should import the file', function () {
        expect(
          this.EditorController.promises.addDocWithRanges
        ).to.have.been.calledWith(
          this.project_id,
          this.folder_id,
          'foo.tex',
          ['foo', 'bar', 'baz'],
          { changes: this.tracked_changes, comment: this.comments }
        )
      })

      it('should return the created entity', function () {
        expect(this.data).to.equal(this.addedFile)
      })

      it('should look up ranges', function () {
        expect(
          this.RestoreManager.promises._getRangesFromHistory
        ).to.have.been.calledWith(this.project_id, this.version, this.pathname)
      })
    })
  })
})
