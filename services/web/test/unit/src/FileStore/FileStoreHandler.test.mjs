import { beforeEach, describe, it, vi, expect } from 'vitest'
import sinon from 'sinon'

const MODULE_PATH =
  '../../../../app/src/Features/FileStore/FileStoreHandler.mjs'

describe('FileStoreHandler', function () {
  beforeEach(async function (ctx) {
    ctx.fileSize = 999
    ctx.fs = {
      createReadStream: sinon.stub(),
      lstat: sinon.stub().callsArgWith(1, null, {
        isFile() {
          return true
        },
        isDirectory() {
          return false
        },
        size: ctx.fileSize,
      }),
    }
    ctx.writeStream = {
      my: 'writeStream',
      on(type, fn) {
        if (type === 'response') {
          fn({ statusCode: 200 })
        }
      },
    }
    ctx.readStream = { my: 'readStream', on: sinon.stub() }
    ctx.request = sinon.stub()
    ctx.request.head = sinon.stub()
    ctx.filestoreUrl = 'http://filestore.overleaf.test'
    ctx.settings = {
      apis: { filestore: { url: ctx.filestoreUrl } },
    }
    ctx.hashValue = '0123456789'
    ctx.fileArgs = { name: 'upload-filename' }
    ctx.fileId = 'file_id_here'
    ctx.projectId = '1312312312'
    ctx.historyId = 123
    ctx.hashValue = '2aae6c35c94fcfb415dbe95f408b9ce91ee846ed'
    ctx.fsPath = 'uploads/myfile.eps'
    ctx.getFileUrl = (projectId, fileId) =>
      `${ctx.filestoreUrl}/project/${projectId}/file/${fileId}`
    ctx.getProjectUrl = projectId => `${ctx.filestoreUrl}/project/${projectId}`
    ctx.FileModel = class File {
      constructor(options) {
        ;({ name: this.name, hash: this.hash } = options)
        this._id = 'file_id_here'
        this.rev = 0
        if (options.linkedFileData != null) {
          this.linkedFileData = options.linkedFileData
        }
      }
    }
    ctx.FileHashManager = {
      computeHash: sinon.stub().callsArgWith(1, null, ctx.hashValue),
    }
    ctx.HistoryManager = {
      uploadBlobFromDisk: sinon.stub().callsArg(4),
    }
    ctx.ProjectDetailsHandler = {
      getDetails: sinon.stub().callsArgWith(1, null, {
        overleaf: { history: { id: ctx.historyId } },
      }),
    }

    ctx.Features = {
      hasFeature: sinon.stub(),
    }

    ctx.Modules = {
      hooks: {
        fire: sinon.stub().callsArgWith(2, null),
      },
    }

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('request', () => ({
      default: ctx.request,
    }))

    vi.doMock('../../../../app/src/Features/History/HistoryManager', () => ({
      default: ctx.HistoryManager,
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectDetailsHandler',
      () => ({
        default: ctx.ProjectDetailsHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/FileStore/FileHashManager', () => ({
      default: ctx.FileHashManager,
    }))

    vi.doMock('../../../../app/src/infrastructure/Features', () => ({
      default: ctx.Features,
    }))

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: ctx.Modules,
    }))

    vi.doMock('../../../../app/src/models/File', () => ({
      File: ctx.FileModel,
    }))

    vi.doMock('node:fs', () => ({ default: ctx.fs }))

    ctx.handler = (await import(MODULE_PATH)).default
  })

  describe('uploadFileFromDisk', function () {
    beforeEach(function (ctx) {
      ctx.request.returns(ctx.writeStream)
    })

    it('should get the project details', async function (ctx) {
      ctx.fs.createReadStream.returns({
        pipe() {},
        on(type, cb) {
          if (type === 'open') {
            cb()
          }
        },
      })
      await ctx.handler.promises.uploadFileFromDisk(
        ctx.projectId,
        ctx.fileArgs,
        ctx.fsPath
      )
      ctx.ProjectDetailsHandler.getDetails
        .calledWith(ctx.projectId)
        .should.equal(true)
    })

    it('should compute the file hash', async function (ctx) {
      ctx.fs.createReadStream.returns({
        pipe() {},
        on(type, cb) {
          if (type === 'open') {
            cb()
          }
        },
      })
      await ctx.handler.promises.uploadFileFromDisk(
        ctx.projectId,
        ctx.fileArgs,
        ctx.fsPath
      )
      ctx.FileHashManager.computeHash.calledWith(ctx.fsPath).should.equal(true)
    })

    it('should call the preUploadFile hook', async function (ctx) {
      ctx.fs.createReadStream.returns({
        pipe() {},
        on(type, cb) {
          if (type === 'open') {
            cb()
          }
        },
      })
      await ctx.handler.promises.uploadFileFromDisk(
        ctx.projectId,
        ctx.fileArgs,
        ctx.fsPath
      )
      ctx.Modules.hooks.fire
        .calledWith('preUploadFile', {
          projectId: ctx.projectId,
          historyId: ctx.historyId,
          fileArgs: ctx.fileArgs,
          fsPath: ctx.fsPath,
          size: ctx.fileSize,
        })
        .should.equal(true)
    })

    it('should upload the file to the history store as a blob', async function (ctx) {
      ctx.fs.createReadStream.returns({
        pipe() {},
        on(type, cb) {
          if (type === 'open') {
            cb()
          }
        },
      })
      await ctx.handler.promises.uploadFileFromDisk(
        ctx.projectId,
        ctx.fileArgs,
        ctx.fsPath
      )
      ctx.HistoryManager.uploadBlobFromDisk
        .calledWith(ctx.historyId, ctx.hashValue, ctx.fileSize, ctx.fsPath)
        .should.equal(true)
    })

    it('should not open file handle', async function (ctx) {
      await ctx.handler.promises.uploadFileFromDisk(
        ctx.projectId,
        ctx.fileArgs,
        ctx.fsPath
      )
      expect(ctx.fs.createReadStream).to.not.have.been.called
    })

    it('should not talk to filestore', async function (ctx) {
      await ctx.handler.promises.uploadFileFromDisk(
        ctx.projectId,
        ctx.fileArgs,
        ctx.fsPath
      )

      expect(ctx.request).to.not.have.been.called
    })

    it('should call the postUploadFile hook', async function (ctx) {
      ctx.fs.createReadStream.returns({
        pipe() {},
        on(type, cb) {
          if (type === 'open') {
            cb()
          }
        },
      })
      await ctx.handler.promises.uploadFileFromDisk(
        ctx.projectId,
        ctx.fileArgs,
        ctx.fsPath
      )
      ctx.Modules.hooks.fire
        .calledWith('postUploadFile', {
          projectId: ctx.projectId,
          fileRef: sinon.match.instanceOf(ctx.FileModel),
          size: ctx.fileSize,
        })
        .should.equal(true)
    })

    it('should resolve with the url and fileRef', async function (ctx) {
      const { fileRef } = await ctx.handler.promises.uploadFileFromDisk(
        ctx.projectId,
        ctx.fileArgs,
        ctx.fsPath
      )
      expect(fileRef._id).to.equal(ctx.fileId)
      expect(fileRef.hash).to.equal(ctx.hashValue)
    })

    describe('symlink', function () {
      it('should not read file if it is symlink', async function (ctx) {
        ctx.fs.lstat = sinon.stub().callsArgWith(1, null, {
          isFile() {
            return false
          },
          isDirectory() {
            return false
          },
        })

        let error

        try {
          await ctx.handler.promises.uploadFileFromDisk(
            ctx.projectId,
            ctx.fileArgs,
            ctx.fsPath
          )
        } catch (err) {
          error = err
        }

        expect(error).to.exist

        ctx.fs.createReadStream.called.should.equal(false)
      })

      it('should not read file stat returns nothing', async function (ctx) {
        ctx.fs.lstat = sinon.stub().callsArgWith(1, null, null)
        let error

        try {
          await ctx.handler.promises.uploadFileFromDisk(
            ctx.projectId,
            ctx.fileArgs,
            ctx.fsPath
          )
        } catch (err) {
          error = err
        }

        expect(error).to.exist

        ctx.fs.createReadStream.called.should.equal(false)
      })
    })
  })
})
