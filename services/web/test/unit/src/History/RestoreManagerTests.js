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
})
