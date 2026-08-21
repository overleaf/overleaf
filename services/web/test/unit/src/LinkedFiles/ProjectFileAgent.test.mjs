import { beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import { Readable } from 'node:stream'

const modulePath =
  '../../../../app/src/Features/LinkedFiles/ProjectFileAgent.mjs'

const SOURCE_BLOB_HASH = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'
const SOURCE_CONTENT = 'source content'

function rawChunk(files, changes = []) {
  return {
    chunk: {
      history: { snapshot: { files }, changes },
      startVersion: 0,
    },
  }
}

describe('ProjectFileAgent', function () {
  beforeEach(async function (ctx) {
    ctx.projectId = 'project-id'
    ctx.fileName = 'linked-file.txt'
    ctx.parentFolderId = 'parent-folder-id'
    ctx.userId = 'user-id'
    ctx.linkedFileData = {
      provider: 'project_file',
      source_project_id: 'source-project-id',
      source_entity_path: '/test.txt',
    }
    ctx.sourceProject = {
      _id: 'source-project-id',
      name: 'source project',
      overleaf: { history: { id: 'source-history-id' } },
    }
    ctx.file = { _id: 'new-file-id' }
    ctx.blobStoreHashes = []

    ctx.AuthorizationManager = {
      promises: { canUserReadProject: sinon.stub().resolves(true) },
    }
    ctx.ProjectLocator = {
      promises: { findElementByPath: sinon.stub() },
    }
    ctx.DocstoreManager = {
      promises: {
        getDoc: sinon.stub().resolves({ lines: ['source', 'content'] }),
      },
    }
    ctx.DocumentUpdaterHandler = {
      promises: { flushProjectToMongo: sinon.stub().resolves() },
    }
    ctx.LinkedFilesHandler = {
      getSourceProject: sinon.stub(),
      promises: {
        getSourceProject: sinon.stub().resolves(ctx.sourceProject),
        importContent: sinon.stub().resolves(ctx.file),
        importFromStream: sinon.stub().resolves(ctx.file),
      },
    }
    ctx.HistoryManager = {
      promises: {
        flushProject: sinon.stub().resolves(),
        requestBlob: sinon
          .stub()
          .resolves({ stream: Readable.from([SOURCE_CONTENT]) }),
        getLatestHistoryWithHistoryId: sinon.stub(),
      },
    }

    vi.doMock(
      '../../../../app/src/Features/Authorization/AuthorizationManager.mjs',
      () => ({ default: ctx.AuthorizationManager })
    )
    vi.doMock(
      '../../../../app/src/Features/Project/ProjectLocator.mjs',
      () => ({
        default: ctx.ProjectLocator,
      })
    )
    vi.doMock(
      '../../../../app/src/Features/Docstore/DocstoreManager.mjs',
      () => ({ default: ctx.DocstoreManager })
    )
    vi.doMock(
      '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler.mjs',
      () => ({ default: ctx.DocumentUpdaterHandler })
    )
    vi.doMock(
      '../../../../app/src/Features/LinkedFiles/LinkedFilesHandler.mjs',
      () => ({ default: ctx.LinkedFilesHandler })
    )
    vi.doMock(
      '../../../../app/src/Features/History/HistoryManager.mjs',
      () => ({ default: ctx.HistoryManager })
    )
    vi.doMock(
      '../../../../app/src/Features/History/HistoryBlobStore.mjs',
      () => ({
        default: class {
          constructor(historyId) {
            ctx.blobStoreHistoryId = historyId
          }

          async getString(hash) {
            ctx.blobStoreHashes.push(hash)
            return SOURCE_CONTENT
          }
        },
      })
    )
    // Import the error classes from the same module graph as the module under
    // test, so that instanceof checks on both sides agree.
    ctx.Errors = (
      await import('../../../../app/src/Features/Errors/Errors.js')
    ).default
    ctx.LinkedFilesErrors = (
      await import('../../../../app/src/Features/LinkedFiles/LinkedFilesErrors.mjs')
    ).default
    ctx.ProjectFileAgent = (await import(modulePath)).default
    ctx.createLinkedFile = () =>
      ctx.ProjectFileAgent.promises.createLinkedFile(
        ctx.projectId,
        ctx.linkedFileData,
        ctx.fileName,
        ctx.parentFolderId,
        ctx.userId,
        ctx.historySource
      )
  })

  describe('_canCreate', function () {
    it('rejects v1 source doc ids', function (ctx) {
      expect(
        ctx.ProjectFileAgent._canCreate({ v1_source_doc_id: 1234 })
      ).to.equal(false)
      expect(
        ctx.ProjectFileAgent._canCreate({ source_project_id: 'id' })
      ).to.equal(true)
    })
  })

  describe('createLinkedFile', function () {
    it('refuses to create a linked file with a v1 source doc id', async function (ctx) {
      ctx.linkedFileData = {
        provider: 'project_file',
        v1_source_doc_id: 1234,
        source_entity_path: '/test.txt',
      }
      await expect(ctx.createLinkedFile()).to.be.rejectedWith(
        ctx.LinkedFilesErrors.AccessDeniedError
      )
    })

    it('refuses to read a source project the user cannot access', async function (ctx) {
      ctx.AuthorizationManager.promises.canUserReadProject.resolves(false)
      await expect(ctx.createLinkedFile()).to.be.rejectedWith(
        ctx.LinkedFilesErrors.AccessDeniedError
      )
    })

    it('refuses to import without a source entity path', async function (ctx) {
      delete ctx.linkedFileData.source_entity_path
      await expect(ctx.createLinkedFile()).to.be.rejectedWith(
        ctx.LinkedFilesErrors.BadDataError
      )
    })
  })

  describe('with the source in the project tree', function () {
    beforeEach(function (ctx) {
      ctx.historySource = false
    })

    it('imports the content of a doc', async function (ctx) {
      ctx.ProjectLocator.promises.findElementByPath.resolves({
        element: { _id: 'source-doc-id' },
        type: 'doc',
      })

      expect(await ctx.createLinkedFile()).to.equal('new-file-id')

      expect(
        ctx.DocumentUpdaterHandler.promises.flushProjectToMongo
      ).to.have.been.calledWith('source-project-id')
      expect(
        ctx.ProjectLocator.promises.findElementByPath
      ).to.have.been.calledWith({
        project_id: 'source-project-id',
        path: '/test.txt',
        exactCaseMatch: true,
      })
      expect(
        ctx.LinkedFilesHandler.promises.importContent
      ).to.have.been.calledWith(
        ctx.projectId,
        'source\ncontent',
        ctx.linkedFileData,
        ctx.fileName,
        ctx.parentFolderId,
        ctx.userId
      )
    })

    it('imports the content of a file from its blob', async function (ctx) {
      ctx.ProjectLocator.promises.findElementByPath.resolves({
        element: { _id: 'source-file-id', hash: SOURCE_BLOB_HASH },
        type: 'file',
      })

      expect(await ctx.createLinkedFile()).to.equal('new-file-id')

      expect(ctx.HistoryManager.promises.requestBlob).to.have.been.calledWith(
        'source-history-id',
        SOURCE_BLOB_HASH
      )
      expect(ctx.LinkedFilesHandler.promises.importFromStream).to.have.been
        .called
    })

    it('reports a missing source file', async function (ctx) {
      ctx.ProjectLocator.promises.findElementByPath.rejects(
        new ctx.Errors.NotFoundError()
      )
      await expect(ctx.createLinkedFile()).to.be.rejectedWith(
        ctx.LinkedFilesErrors.SourceFileNotFoundError
      )
    })

    it('reports a source path that is a folder', async function (ctx) {
      ctx.ProjectLocator.promises.findElementByPath.resolves({
        element: { _id: 'source-folder-id' },
        type: 'folder',
      })
      await expect(ctx.createLinkedFile()).to.be.rejectedWith(
        ctx.LinkedFilesErrors.BadEntityTypeError
      )
    })

    it('does not read from history', async function (ctx) {
      ctx.ProjectLocator.promises.findElementByPath.resolves({
        element: { _id: 'source-doc-id' },
        type: 'doc',
      })
      await ctx.createLinkedFile()

      expect(ctx.HistoryManager.promises.flushProject).to.not.have.been.called
      expect(ctx.HistoryManager.promises.getLatestHistoryWithHistoryId).to.not
        .have.been.called
    })
  })

  describe('with the source in the history snapshot', function () {
    beforeEach(function (ctx) {
      ctx.historySource = true
      ctx.HistoryManager.promises.getLatestHistoryWithHistoryId.resolves(
        rawChunk({
          'test.txt': {
            hash: SOURCE_BLOB_HASH,
            stringLength: SOURCE_CONTENT.length,
          },
        })
      )
    })

    it('flushes the source project into history before reading it', async function (ctx) {
      await ctx.createLinkedFile()

      expect(
        ctx.DocumentUpdaterHandler.promises.flushProjectToMongo
      ).to.have.been.calledWith('source-project-id')
      expect(ctx.HistoryManager.promises.flushProject).to.have.been.calledWith(
        'source-project-id'
      )
      expect(
        ctx.HistoryManager.promises.getLatestHistoryWithHistoryId
      ).to.have.been.calledWith('source-history-id')
      expect(
        ctx.HistoryManager.promises.flushProject
      ).to.have.been.calledBefore(
        ctx.HistoryManager.promises.getLatestHistoryWithHistoryId
      )
    })

    it('does not look up the source path in the project tree', async function (ctx) {
      await ctx.createLinkedFile()

      expect(ctx.ProjectLocator.promises.findElementByPath).to.not.have.been
        .called
    })

    it('imports the content of an editable file', async function (ctx) {
      expect(await ctx.createLinkedFile()).to.equal('new-file-id')

      expect(ctx.blobStoreHistoryId).to.equal('source-history-id')
      expect(ctx.blobStoreHashes).to.deep.equal([SOURCE_BLOB_HASH])
      expect(
        ctx.LinkedFilesHandler.promises.importContent
      ).to.have.been.calledWith(
        ctx.projectId,
        SOURCE_CONTENT,
        ctx.linkedFileData,
        ctx.fileName,
        ctx.parentFolderId,
        ctx.userId
      )
      expect(ctx.HistoryManager.promises.requestBlob).to.not.have.been.called
    })

    it('streams the blob of a file that is not editable', async function (ctx) {
      ctx.HistoryManager.promises.getLatestHistoryWithHistoryId.resolves(
        rawChunk({
          'test.txt': {
            hash: SOURCE_BLOB_HASH,
            byteLength: SOURCE_CONTENT.length,
          },
        })
      )

      expect(await ctx.createLinkedFile()).to.equal('new-file-id')

      expect(ctx.HistoryManager.promises.requestBlob).to.have.been.calledWith(
        'source-history-id',
        SOURCE_BLOB_HASH
      )
      expect(ctx.LinkedFilesHandler.promises.importFromStream).to.have.been
        .called
      expect(ctx.LinkedFilesHandler.promises.importContent).to.not.have.been
        .called
      expect(ctx.blobStoreHashes).to.deep.equal([])
    })

    it('imports the content of a file with pending edits', async function (ctx) {
      ctx.HistoryManager.promises.getLatestHistoryWithHistoryId.resolves(
        rawChunk(
          {
            'test.txt': {
              hash: SOURCE_BLOB_HASH,
              stringLength: SOURCE_CONTENT.length,
            },
          },
          [
            {
              operations: [
                {
                  pathname: 'test.txt',
                  textOperation: ['edited ', SOURCE_CONTENT.length],
                },
              ],
              timestamp: '2026-08-11T09:00:00.000Z',
            },
          ]
        )
      )

      expect(await ctx.createLinkedFile()).to.equal('new-file-id')

      expect(ctx.blobStoreHistoryId).to.equal('source-history-id')
      expect(ctx.blobStoreHashes).to.deep.equal([SOURCE_BLOB_HASH])
      expect(
        ctx.LinkedFilesHandler.promises.importContent
      ).to.have.been.calledWith(
        ctx.projectId,
        `edited ${SOURCE_CONTENT}`,
        ctx.linkedFileData,
        ctx.fileName,
        ctx.parentFolderId,
        ctx.userId
      )
      expect(ctx.HistoryManager.promises.requestBlob).to.not.have.been.called
    })

    it('accepts a source path without a leading slash', async function (ctx) {
      ctx.linkedFileData.source_entity_path = 'test.txt'
      expect(await ctx.createLinkedFile()).to.equal('new-file-id')
    })

    it('reports a missing source file', async function (ctx) {
      ctx.linkedFileData.source_entity_path = '/other.txt'
      await expect(ctx.createLinkedFile()).to.be.rejectedWith(
        ctx.LinkedFilesErrors.SourceFileNotFoundError
      )
    })

    it('reports a source path that is a folder', async function (ctx) {
      ctx.HistoryManager.promises.getLatestHistoryWithHistoryId.resolves(
        rawChunk({
          'folder/test.txt': {
            hash: SOURCE_BLOB_HASH,
            stringLength: SOURCE_CONTENT.length,
          },
        })
      )
      ctx.linkedFileData.source_entity_path = '/folder'
      await expect(ctx.createLinkedFile()).to.be.rejectedWith(
        ctx.LinkedFilesErrors.BadEntityTypeError
      )
    })

    it('reads the snapshot when refreshing too', async function (ctx) {
      expect(
        await ctx.ProjectFileAgent.promises.refreshLinkedFile(
          ctx.projectId,
          ctx.linkedFileData,
          ctx.fileName,
          ctx.parentFolderId,
          ctx.userId,
          true
        )
      ).to.equal('new-file-id')

      expect(ctx.HistoryManager.promises.flushProject).to.have.been.calledWith(
        'source-project-id'
      )
    })
  })
})
