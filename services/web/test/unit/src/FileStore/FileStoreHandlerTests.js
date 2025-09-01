const { expect } = require('chai')
const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')

const MODULE_PATH = '../../../../app/src/Features/FileStore/FileStoreHandler.js'

describe('FileStoreHandler', function () {
  beforeEach(function () {
    this.fileSize = 999
    this.fs = {
      createReadStream: sinon.stub(),
      lstat: sinon.stub().callsArgWith(1, null, {
        isFile() {
          return true
        },
        isDirectory() {
          return false
        },
        size: this.fileSize,
      }),
    }
    this.writeStream = {
      my: 'writeStream',
      on(type, fn) {
        if (type === 'response') {
          fn({ statusCode: 200 })
        }
      },
    }
    this.readStream = { my: 'readStream', on: sinon.stub() }
    this.request = sinon.stub()
    this.request.head = sinon.stub()
    this.filestoreUrl = 'http://filestore.overleaf.test'
    this.settings = {
      apis: { filestore: { url: this.filestoreUrl } },
    }
    this.hashValue = '0123456789'
    this.fileArgs = { name: 'upload-filename' }
    this.fileId = 'file_id_here'
    this.projectId = '1312312312'
    this.historyId = 123
    this.hashValue = '2aae6c35c94fcfb415dbe95f408b9ce91ee846ed'
    this.fsPath = 'uploads/myfile.eps'
    this.getFileUrl = (projectId, fileId) =>
      `${this.filestoreUrl}/project/${projectId}/file/${fileId}`
    this.getProjectUrl = projectId =>
      `${this.filestoreUrl}/project/${projectId}`
    this.FileModel = class File {
      constructor(options) {
        ;({ name: this.name, hash: this.hash } = options)
        this._id = 'file_id_here'
        this.rev = 0
        if (options.linkedFileData != null) {
          this.linkedFileData = options.linkedFileData
        }
      }
    }
    this.FileHashManager = {
      computeHash: sinon.stub().callsArgWith(1, null, this.hashValue),
    }
    this.HistoryManager = {
      uploadBlobFromDisk: sinon.stub().callsArg(4),
    }
    this.ProjectDetailsHandler = {
      getDetails: sinon.stub().callsArgWith(1, null, {
        overleaf: { history: { id: this.historyId } },
      }),
    }

    this.Features = {
      hasFeature: sinon.stub(),
    }

    this.handler = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '@overleaf/settings': this.settings,
        request: this.request,
        '../History/HistoryManager': this.HistoryManager,
        '../Project/ProjectDetailsHandler': this.ProjectDetailsHandler,
        './FileHashManager': this.FileHashManager,
        '../../infrastructure/Features': this.Features,
        // FIXME: need to stub File object here
        '../../models/File': {
          File: this.FileModel,
        },
        fs: this.fs,
      },
    })
  })

  describe('uploadFileFromDisk', function () {
    beforeEach(function () {
      this.request.returns(this.writeStream)
    })

    it('should get the project details', async function () {
      this.fs.createReadStream.returns({
        pipe() {},
        on(type, cb) {
          if (type === 'open') {
            cb()
          }
        },
      })
      await this.handler.promises.uploadFileFromDisk(
        this.projectId,
        this.fileArgs,
        this.fsPath
      )
      this.ProjectDetailsHandler.getDetails
        .calledWith(this.projectId)
        .should.equal(true)
    })

    it('should compute the file hash', async function () {
      this.fs.createReadStream.returns({
        pipe() {},
        on(type, cb) {
          if (type === 'open') {
            cb()
          }
        },
      })
      await this.handler.promises.uploadFileFromDisk(
        this.projectId,
        this.fileArgs,
        this.fsPath
      )
      this.FileHashManager.computeHash
        .calledWith(this.fsPath)
        .should.equal(true)
    })

    it('should upload the file to the history store as a blob', async function () {
      this.fs.createReadStream.returns({
        pipe() {},
        on(type, cb) {
          if (type === 'open') {
            cb()
          }
        },
      })
      await this.handler.promises.uploadFileFromDisk(
        this.projectId,
        this.fileArgs,
        this.fsPath
      )
      this.HistoryManager.uploadBlobFromDisk
        .calledWith(this.historyId, this.hashValue, this.fileSize, this.fsPath)
        .should.equal(true)
    })

    it('should not open file handle', async function () {
      await this.handler.promises.uploadFileFromDisk(
        this.projectId,
        this.fileArgs,
        this.fsPath
      )
      expect(this.fs.createReadStream).to.not.have.been.called
    })

    it('should not talk to filestore', async function () {
      await this.handler.promises.uploadFileFromDisk(
        this.projectId,
        this.fileArgs,
        this.fsPath
      )

      expect(this.request).to.not.have.been.called
    })

    it('should resolve with the url and fileRef', async function () {
      const { fileRef } = await this.handler.promises.uploadFileFromDisk(
        this.projectId,
        this.fileArgs,
        this.fsPath
      )
      expect(fileRef._id).to.equal(this.fileId)
      expect(fileRef.hash).to.equal(this.hashValue)
    })

    describe('symlink', function () {
      it('should not read file if it is symlink', async function () {
        this.fs.lstat = sinon.stub().callsArgWith(1, null, {
          isFile() {
            return false
          },
          isDirectory() {
            return false
          },
        })

        let error

        try {
          await this.handler.promises.uploadFileFromDisk(
            this.projectId,
            this.fileArgs,
            this.fsPath
          )
        } catch (err) {
          error = err
        }

        expect(error).to.exist

        this.fs.createReadStream.called.should.equal(false)
      })

      it('should not read file stat returns nothing', async function () {
        this.fs.lstat = sinon.stub().callsArgWith(1, null, null)
        let error

        try {
          await this.handler.promises.uploadFileFromDisk(
            this.projectId,
            this.fileArgs,
            this.fsPath
          )
        } catch (err) {
          error = err
        }

        expect(error).to.exist

        this.fs.createReadStream.called.should.equal(false)
      })
    })
  })
})
