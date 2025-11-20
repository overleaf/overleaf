import { vi, expect } from 'vitest'
import sinon from 'sinon'
import { Writable } from 'node:stream'
import mongodb from 'mongodb-legacy'

const { ObjectId } = mongodb

const MODULE_PATH =
  '../../../../app/src/Features/ThirdPartyDataStore/UpdateMerger.mjs'

describe('UpdateMerger :', function () {
  beforeEach(async function (ctx) {
    ctx.projectId = 'project_id_here'
    ctx.userId = 'mock-user-id'
    ctx.randomUUID = 'random-uuid'
    ctx.dumpPath = '/dump'

    ctx.docPath = ctx.newDocPath = '/folder/doc.tex'
    ctx.filePath = ctx.newFilePath = '/folder/file.png'

    ctx.existingDocPath = '/folder/other.tex'
    ctx.existingFilePath = '/folder/fig1.pdf'

    ctx.linkedFileData = { provider: 'url' }

    ctx.existingDocs = [{ path: '/main.tex' }, { path: '/folder/other.tex' }]
    ctx.existingFiles = [{ path: '/figure.pdf' }, { path: '/folder/fig1.pdf' }]

    ctx.fsPath = `${ctx.dumpPath}/${ctx.projectId}_${ctx.randomUUID}`
    ctx.fileContents = `\\documentclass{article}
\\usepackage[utf8]{inputenc}

\\title{42}
\\author{Jane Doe}
\\date{June 2011}`
    ctx.docLines = ctx.fileContents.split('\n')
    ctx.source = 'dropbox'
    ctx.updateRequest = new Writable()
    ctx.writeStream = new Writable()

    ctx.fsPromises = {
      unlink: sinon.stub().resolves(),
      readFile: sinon.stub().withArgs(ctx.fsPath).resolves(ctx.fileContents),
      mkdir: sinon.stub().resolves(),
    }

    ctx.fs = {
      createWriteStream: sinon.stub().returns(ctx.writeStream),
    }

    ctx.doc = {
      _id: new ObjectId(),
      rev: 2,
    }

    ctx.file = {
      _id: new ObjectId(),
      rev: 6,
    }

    ctx.folder = {
      _id: new ObjectId(),
    }

    ctx.EditorController = {
      promises: {
        deleteEntityWithPath: sinon.stub().resolves(new ObjectId()),
        upsertDocWithPath: sinon
          .stub()
          .resolves({ doc: ctx.doc, folder: ctx.folder }),
        upsertFileWithPath: sinon
          .stub()
          .resolves({ file: ctx.file, folder: ctx.folder }),
      },
    }

    ctx.FileTypeManager = {
      promises: {
        getType: sinon.stub(),
      },
    }

    ctx.crypto = {
      randomUUID: sinon.stub().returns(ctx.randomUUID),
    }

    ctx.ProjectEntityHandler = {
      promises: {
        getAllEntities: sinon.stub().resolves({
          docs: ctx.existingDocs,
          files: ctx.existingFiles,
        }),
      },
    }

    ctx.Settings = { path: { dumpFolder: ctx.dumpPath } }

    ctx.stream = { pipeline: sinon.stub().resolves() }

    vi.doMock('fs/promises', () => ({
      default: ctx.fsPromises,
    }))

    vi.doMock('fs', () => ({
      default: ctx.fs,
    }))

    vi.doMock('../../../../app/src/Features/Editor/EditorController', () => ({
      default: ctx.EditorController,
    }))

    vi.doMock('../../../../app/src/Features/Uploads/FileTypeManager', () => ({
      default: ctx.FileTypeManager,
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEntityHandler',
      () => ({
        default: ctx.ProjectEntityHandler,
      })
    )

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.Settings,
    }))

    vi.doMock('stream/promises', () => ({
      pipeline: ctx.stream.pipeline,
    }))

    vi.doMock('crypto', () => ({
      default: ctx.crypto,
    }))

    ctx.UpdateMerger = (await import(MODULE_PATH)).default
  })

  describe('mergeUpdate', function () {
    describe('doc updates for a new doc', function () {
      beforeEach(async function (ctx) {
        ctx.FileTypeManager.promises.getType.resolves({
          binary: false,
          encoding: 'utf-8',
        })
        ctx.mergeUpdateResult = await ctx.UpdateMerger.promises.mergeUpdate(
          ctx.userId,
          ctx.projectId,
          ctx.docPath,
          ctx.updateRequest,
          ctx.source
        )
      })

      it('should look at the file contents', function (ctx) {
        expect(ctx.FileTypeManager.promises.getType).to.have.been.called
      })

      it('should process update as doc', function (ctx) {
        expect(
          ctx.EditorController.promises.upsertDocWithPath
        ).to.have.been.calledWith(
          ctx.projectId,
          ctx.docPath,
          ctx.docLines,
          ctx.source,
          ctx.userId
        )
      })

      it('removes the temp file from disk', function (ctx) {
        expect(ctx.fsPromises.unlink).to.have.been.calledWith(ctx.fsPath)
      })

      it('returns the entity id and rev', function (ctx) {
        expect(ctx.mergeUpdateResult.entityId).to.be.instanceOf(ObjectId)
        expect(ctx.mergeUpdateResult.rev).to.equal(2)
      })
    })

    describe('file updates for a new file ', function () {
      beforeEach(async function (ctx) {
        ctx.FileTypeManager.promises.getType.resolves({ binary: true })
        ctx.mergeUpdateResult = await ctx.UpdateMerger.promises.mergeUpdate(
          ctx.userId,
          ctx.projectId,
          ctx.filePath,
          ctx.updateRequest,
          ctx.source
        )
      })

      it('should look at the file contents', function (ctx) {
        expect(ctx.FileTypeManager.promises.getType).to.have.been.called
      })

      it('should process update as file', function (ctx) {
        expect(
          ctx.EditorController.promises.upsertFileWithPath
        ).to.have.been.calledWith(
          ctx.projectId,
          ctx.filePath,
          ctx.fsPath,
          null,
          ctx.source,
          ctx.userId
        )
      })

      it('removes the temp file from disk', function (ctx) {
        expect(ctx.fsPromises.unlink).to.have.been.calledWith(ctx.fsPath)
      })

      it('returns the entity id and rev', function (ctx) {
        expect(ctx.mergeUpdateResult.entityId).to.be.instanceOf(ObjectId)
        expect(ctx.mergeUpdateResult.rev).to.equal(6)
      })
    })

    describe('doc updates for an existing doc', function () {
      beforeEach(async function (ctx) {
        ctx.FileTypeManager.promises.getType.resolves({
          binary: false,
          encoding: 'utf-8',
        })
        ctx.mergeUpdateResult = await ctx.UpdateMerger.promises.mergeUpdate(
          ctx.userId,
          ctx.projectId,
          ctx.existingDocPath,
          ctx.updateRequest,
          ctx.source
        )
      })

      it('should look at the file contents', function (ctx) {
        expect(ctx.FileTypeManager.promises.getType).to.have.been.called
      })

      it('should process update as doc', function (ctx) {
        expect(
          ctx.EditorController.promises.upsertDocWithPath
        ).to.have.been.calledWith(
          ctx.projectId,
          ctx.existingDocPath,
          ctx.docLines,
          ctx.source,
          ctx.userId
        )
      })

      it('removes the temp file from disk', function (ctx) {
        expect(ctx.fsPromises.unlink).to.have.been.calledWith(ctx.fsPath)
      })

      it('returns the entity id and rev', function (ctx) {
        expect(ctx.mergeUpdateResult.entityId).to.be.instanceOf(ObjectId)
        expect(ctx.mergeUpdateResult.rev).to.equal(2)
      })
    })

    describe('file updates for an existing file', function () {
      beforeEach(async function (ctx) {
        ctx.FileTypeManager.promises.getType.resolves({ binary: true })
        ctx.mergeUpdateResult = await ctx.UpdateMerger.promises.mergeUpdate(
          ctx.userId,
          ctx.projectId,
          ctx.existingFilePath,
          ctx.updateRequest,
          ctx.source
        )
      })

      it('should look at the file contents', function (ctx) {
        expect(ctx.FileTypeManager.promises.getType).to.have.been.called
      })

      it('should process update as file', function (ctx) {
        expect(
          ctx.EditorController.promises.upsertFileWithPath
        ).to.have.been.calledWith(
          ctx.projectId,
          ctx.existingFilePath,
          ctx.fsPath,
          null,
          ctx.source,
          ctx.userId
        )
      })

      it('removes the temp file from disk', function (ctx) {
        expect(ctx.fsPromises.unlink).to.have.been.calledWith(ctx.fsPath)
      })

      it('returns the entity id and rev', function (ctx) {
        expect(ctx.mergeUpdateResult.entityId).to.be.instanceOf(ObjectId)
        expect(ctx.mergeUpdateResult.rev).to.equal(6)
      })
    })
  })

  describe('file updates for an existing doc', function () {
    beforeEach(async function (ctx) {
      ctx.FileTypeManager.promises.getType.resolves({ binary: true })
      ctx.mergeUpdateResult = await ctx.UpdateMerger.promises.mergeUpdate(
        ctx.userId,
        ctx.projectId,
        ctx.existingDocPath,
        ctx.updateRequest,
        ctx.source
      )
    })

    it('should look at the file contents', function (ctx) {
      expect(ctx.FileTypeManager.promises.getType).to.have.been.called
    })

    it('should process update as file', function (ctx) {
      expect(
        ctx.EditorController.promises.upsertFileWithPath
      ).to.have.been.calledWith(
        ctx.projectId,
        ctx.existingDocPath,
        ctx.fsPath,
        null,
        ctx.source,
        ctx.userId
      )
    })

    it('removes the temp file from disk', function (ctx) {
      expect(ctx.fsPromises.unlink).to.have.been.calledWith(ctx.fsPath)
    })

    it('returns the entity id and rev', function (ctx) {
      expect(ctx.mergeUpdateResult.entityId).to.be.instanceOf(ObjectId)
      expect(ctx.mergeUpdateResult.rev).to.equal(6)
    })
  })

  describe('doc updates for an existing file', function () {
    beforeEach(async function (ctx) {
      ctx.FileTypeManager.promises.getType.resolves({ binary: true })
      ctx.mergeUpdateResult = await ctx.UpdateMerger.promises.mergeUpdate(
        ctx.userId,
        ctx.projectId,
        ctx.existingFilePath,
        ctx.updateRequest,
        ctx.source
      )
    })

    it('should look at the file contents', function (ctx) {
      expect(ctx.FileTypeManager.promises.getType).to.have.been.called
    })

    it('should not delete the existing file', function (ctx) {
      expect(ctx.EditorController.promises.deleteEntityWithPath).to.not.have
        .been.called
    })

    it('should process update as file', function (ctx) {
      expect(
        ctx.EditorController.promises.upsertFileWithPath
      ).to.have.been.calledWith(
        ctx.projectId,
        ctx.existingFilePath,
        ctx.fsPath,
        null,
        ctx.source,
        ctx.userId
      )
    })

    it('removes the temp file from disk', function (ctx) {
      expect(ctx.fsPromises.unlink).to.have.been.calledWith(ctx.fsPath)
    })

    it('returns the entity id and rev', function (ctx) {
      expect(ctx.mergeUpdateResult.entityId).to.be.instanceOf(ObjectId)
      expect(ctx.mergeUpdateResult.rev).to.equal(6)
    })
  })

  describe('deleteUpdate', function () {
    beforeEach(async function (ctx) {
      ctx.deleteUpdateResult = await ctx.UpdateMerger.promises.deleteUpdate(
        ctx.userId,
        ctx.projectId,
        ctx.docPath,
        ctx.source
      )
    })

    afterEach(function (ctx) {
      delete ctx.deleteUpdateResult
    })

    it('should delete the entity in the editor controller', function (ctx) {
      expect(
        ctx.EditorController.promises.deleteEntityWithPath
      ).to.have.been.calledWith(
        ctx.projectId,
        ctx.docPath,
        ctx.source,
        ctx.userId
      )
    })

    it('returns the entity id', function (ctx) {
      expect(ctx.deleteUpdateResult).to.be.instanceOf(ObjectId)
    })
  })
})
