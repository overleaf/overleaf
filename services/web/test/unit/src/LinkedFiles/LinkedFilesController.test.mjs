import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import { setReqValidationModeForTests } from '@overleaf/validation-tools'
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

  afterEach(function () {
    setReqValidationModeForTests(null)
  })

  beforeEach(async function (ctx) {
    ctx.userId = 'user-id'
    ctx.Agent = {
      promises: {
        createLinkedFile: sinon.stub().resolves(),
        refreshLinkedFile: sinon.stub().resolves(),
      },
    }
    // project_id, parent_folder_id and file_id are validated as Mongo
    // ObjectIds, so use well-formed values throughout.
    ctx.projectId = '507f1f77bcf86cd799439011'
    ctx.parentFolderId = '507f191e810c19729de860eb'
    // must be one of the real, schema-validated provider literals; 'url' is
    // the simplest shape (a single required `url` field in `data`).
    ctx.provider = 'url'
    ctx.fileName = 'linked-file-name'
    ctx.data = { url: 'https://example.com/foo' }
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
          parent_folder_id: ctx.parentFolderId,
        },
      }
      ctx.next = sinon.stub()
    })

    it('sets importedAt timestamp on linkedFileData', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.next = sinon
          .stub()
          .callsFake(err =>
            reject(err || new Error('next called unexpectedly'))
          )
        ctx.res = {
          json: () => {
            expect(ctx.Agent.promises.createLinkedFile).to.have.been.calledWith(
              ctx.projectId,
              {
                url: 'https://example.com/foo',
                provider: ctx.provider,
                importedAt: ctx.fakeTime.toISOString(),
              },
              ctx.fileName,
              ctx.parentFolderId,
              ctx.userId
            )
            resolve()
          },
        }
        ctx.LinkedFilesController.createLinkedFile(ctx.req, ctx.res, ctx.next)
      })
    })

    it('rejects a mendeley group_id containing a path separator without calling the agent', async function (ctx) {
      setReqValidationModeForTests('enforce')
      ctx.req.body.provider = 'mendeley'
      ctx.req.body.data = { group_id: 'abcd/../../etc' }
      await new Promise(resolve => {
        ctx.next = sinon.stub().callsFake(() => resolve())
        ctx.res = {
          json: () => resolve(),
          sendStatus: () => resolve(),
        }
        ctx.LinkedFilesController.createLinkedFile(ctx.req, ctx.res, ctx.next)
      })
      expect(ctx.next).to.have.been.calledOnce
      expect(ctx.next.firstCall.args[0]?.name).to.equal('InvalidRequestError')
      expect(ctx.Agent.promises.createLinkedFile).to.not.have.been.called
    })

    it('rejects a project_output_file build_id that is not in the hex-hyphen-hex shape without calling the agent', async function (ctx) {
      setReqValidationModeForTests('enforce')
      ctx.req.body.provider = 'project_output_file'
      ctx.req.body.data = {
        source_output_file_path: 'output.pdf',
        build_id: 'not-a-valid-build-id',
      }
      await new Promise(resolve => {
        ctx.next = sinon.stub().callsFake(() => resolve())
        ctx.res = {
          json: () => resolve(),
          sendStatus: () => resolve(),
        }
        ctx.LinkedFilesController.createLinkedFile(ctx.req, ctx.res, ctx.next)
      })
      expect(ctx.next).to.have.been.calledOnce
      expect(ctx.next.firstCall.args[0]?.name).to.equal('InvalidRequestError')
      expect(ctx.Agent.promises.createLinkedFile).to.not.have.been.called
    })
  })
  describe('refreshLinkedFiles', function () {
    beforeEach(function (ctx) {
      ctx.fileId = '507f191e810c19729de860ea'
      ctx.data.provider = ctx.provider
      ctx.file = {
        name: ctx.fileName,
        linkedFileData: {
          ...ctx.data,
          importedAt: new Date(2020, 1, 1).toISOString(),
        },
      }
      ctx.LinkedFilesHandler.promises.getFileById
        .withArgs(ctx.projectId, ctx.fileId)
        .resolves({
          file: ctx.file,
          path: 'fake-path',
          parentFolder: {
            _id: 'parent-folder-id',
          },
        })
      ctx.req = {
        params: { project_id: ctx.projectId, file_id: ctx.fileId },
        body: {},
      }
      ctx.next = sinon.stub()
    })

    it('resets importedAt timestamp on linkedFileData', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.next = sinon
          .stub()
          .callsFake(err =>
            reject(err || new Error('next called unexpectedly'))
          )
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
              ctx.fileName,
              'parent-folder-id',
              ctx.userId
            )
            resolve()
          },
        }
        ctx.LinkedFilesController.refreshLinkedFile(ctx.req, ctx.res, ctx.next)
      })
    })

    it('rejects invalid params without calling the agent', async function (ctx) {
      setReqValidationModeForTests('enforce')
      ctx.req.params.file_id = 'not-an-object-id'
      await new Promise(resolve => {
        ctx.next = sinon.stub().callsFake(() => resolve())
        ctx.res = {
          json: () => resolve(),
          sendStatus: () => resolve(),
        }
        ctx.LinkedFilesController.refreshLinkedFile(ctx.req, ctx.res, ctx.next)
      })
      expect(ctx.next).to.have.been.calledOnce
      expect(ctx.next.firstCall.args[0]?.name).to.equal('InvalidParamsError')
      expect(ctx.Agent.promises.refreshLinkedFile).to.not.have.been.called
    })

    describe('when bib file re-indexing is required', function () {
      const clientId = 'client-id'
      beforeEach(function (ctx) {
        ctx.req.body.shouldReindexReferences = true
        ctx.req.body.clientId = clientId
      })

      it('informs clients to re-index bib references', async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.next = sinon
            .stub()
            .callsFake(err =>
              reject(err || new Error('next called unexpectedly'))
            )
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
