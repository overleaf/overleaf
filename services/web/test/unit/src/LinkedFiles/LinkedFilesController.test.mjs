import { expect, vi } from 'vitest'
import sinon from 'sinon'
const modulePath =
  '../../../../app/src/Features/LinkedFiles/LinkedFilesController.mjs'

describe('LinkedFilesController', function () {
  beforeEach(function (ctx) {
    ctx.fakeTime = new Date()
    ctx.clock = sinon.useFakeTimers(ctx.fakeTime.getTime())
  })

  afterEach(function (ctx) {
    ctx.clock.restore()
  })

  beforeEach(async function (ctx) {
    ctx.userId = 'user-id'
    ctx.Agent = {
      promises: {
        createLinkedFile: sinon.stub().resolves(),
        refreshLinkedFile: sinon.stub().resolves(),
      },
    }
    ctx.projectId = 'projectId'
    ctx.provider = 'provider'
    ctx.fileName = 'linked-file-name'
    ctx.data = { customAgentData: 'foo' }
    ctx.LinkedFilesHandler = {
      promises: {
        getFileById: sinon.stub(),
      },
    }
    ctx.AnalyticsManager = {}
    ctx.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(ctx.userId),
    }
    ctx.EditorRealTimeController = { emitToRoom: sinon.stub() }
    ctx.UrlAgent = {}
    ctx.ProjectFileAgent = {}
    ctx.ProjectOutputFileAgent = {}
    ctx.EditorController = {}
    ctx.ProjectLocator = {}
    ctx.logger = {
      error: sinon.stub(),
    }
    ctx.settings = { enabledLinkedFileTypes: [] }

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: ctx.SessionManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({
        default: ctx.AnalyticsManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/LinkedFiles/LinkedFilesHandler',
      () => ({
        default: ctx.LinkedFilesHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Editor/EditorRealTimeController',
      () => ({
        default: ctx.EditorRealTimeController,
      })
    )

    vi.doMock('../../../../app/src/Features/LinkedFiles/UrlAgent', () => ({
      default: ctx.UrlAgent,
    }))

    vi.doMock(
      '../../../../app/src/Features/LinkedFiles/ProjectFileAgent',
      () => ({
        default: ctx.ProjectFileAgent,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/LinkedFiles/ProjectOutputFileAgent',
      () => ({
        default: ctx.ProjectOutputFileAgent,
      })
    )

    vi.doMock('../../../../app/src/Features/Editor/EditorController', () => ({
      default: ctx.EditorController,
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectLocator', () => ({
      default: ctx.ProjectLocator,
    }))

    vi.doMock('@overleaf/logger', () => ({
      default: ctx.logger,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    ctx.LinkedFilesController = (await import(modulePath)).default
    ctx.LinkedFilesController._getAgent = sinon.stub().resolves(ctx.Agent)
  })

  describe('createLinkedFile', function () {
    beforeEach(function (ctx) {
      ctx.req = {
        params: { project_id: ctx.projectId },
        body: {
          name: ctx.fileName,
          provider: ctx.provider,
          data: ctx.data,
        },
      }
      ctx.next = sinon.stub()
    })

    it('sets importedAt timestamp on linkedFileData', async function (ctx) {
      await new Promise(resolve => {
        ctx.next = sinon.stub().callsFake(() => resolve('unexpected error'))
        ctx.res = {
          json: () => {
            expect(ctx.Agent.promises.createLinkedFile).to.have.been.calledWith(
              ctx.projectId,
              { ...ctx.data, importedAt: ctx.fakeTime.toISOString() },
              ctx.fileName,
              undefined,
              ctx.userId
            )
            resolve()
          },
        }
        ctx.LinkedFilesController.createLinkedFile(ctx.req, ctx.res, ctx.next)
      })
    })
  })
  describe('refreshLinkedFiles', function () {
    beforeEach(function (ctx) {
      ctx.data.provider = ctx.provider
      ctx.file = {
        name: ctx.fileName,
        linkedFileData: {
          ...ctx.data,
          importedAt: new Date(2020, 1, 1).toISOString(),
        },
      }
      ctx.LinkedFilesHandler.promises.getFileById
        .withArgs(ctx.projectId, 'file-id')
        .resolves({
          file: ctx.file,
          path: 'fake-path',
          parentFolder: {
            _id: 'parent-folder-id',
          },
        })
      ctx.req = {
        params: { project_id: ctx.projectId, file_id: 'file-id' },
        body: {},
      }
      ctx.next = sinon.stub()
    })

    it('resets importedAt timestamp on linkedFileData', async function (ctx) {
      await new Promise(resolve => {
        ctx.next = sinon.stub().callsFake(() => resolve('unexpected error'))
        ctx.res = {
          json: () => {
            expect(
              ctx.Agent.promises.refreshLinkedFile
            ).to.have.been.calledWith(
              ctx.projectId,
              {
                ...ctx.data,
                importedAt: ctx.fakeTime.toISOString(),
              },
              ctx.name,
              'parent-folder-id',
              ctx.userId
            )
            resolve()
          },
        }
        ctx.LinkedFilesController.refreshLinkedFile(ctx.req, ctx.res, ctx.next)
      })
    })

    describe('when bib file re-indexing is required', function () {
      const clientId = 'client-id'
      beforeEach(function (ctx) {
        ctx.req.body.shouldReindexReferences = true
        ctx.req.body.clientId = clientId
      })

      it('informs clients to re-index bib references', async function (ctx) {
        await new Promise(resolve => {
          ctx.next = sinon.stub().callsFake(() => resolve('unexpected error'))
          ctx.res = {
            json: () => {
              expect(
                ctx.EditorRealTimeController.emitToRoom
              ).to.have.been.calledWith(
                ctx.projectId,
                'references:keys:updated',
                [],
                true,
                clientId
              )
              resolve()
            },
          }
          ctx.LinkedFilesController.refreshLinkedFile(
            ctx.req,
            ctx.res,
            ctx.next
          )
        })
      })
    })
  })
})
