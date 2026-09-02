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
      warn: sinon.stub(),
    }
    // parseReq logs through the same stub, so find the call this suite is about
    // rather than assuming it is the only one.
    ctx.lastLinkedFileWarning = () =>
      ctx.logger.warn
        .getCalls()
        .filter(call => call.args[1] === 'failed to create/refresh linked file')
        .pop()?.args[0]
    ctx.settings = { enabledLinkedFileTypes: [] }
    ctx.SplitTestHandler = {
      promises: { featureFlagEnabled: sinon.stub().resolves(false) },
    }

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler',
      () => ({
        default: ctx.SplitTestHandler,
      })
    )

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
              ctx.userId,
              false
            )
            resolve()
          },
        }
        ctx.LinkedFilesController.createLinkedFile(ctx.req, ctx.res, ctx.next)
      })
    })

    it('passes on the linked-file-from-history assignment', async function (ctx) {
      ctx.SplitTestHandler.promises.featureFlagEnabled.resolves(true)
      await new Promise((resolve, reject) => {
        ctx.next = sinon
          .stub()
          .callsFake(err =>
            reject(err || new Error('next called unexpectedly'))
          )
        ctx.res = {
          json: () => {
            expect(
              ctx.SplitTestHandler.promises.featureFlagEnabled
            ).to.have.been.calledWith(
              ctx.req,
              ctx.res,
              'linked-file-from-history',
              { includeReferer: true }
            )
            expect(
              ctx.Agent.promises.createLinkedFile.firstCall.args[5]
            ).to.equal(true)
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

    it('logs the failure with the linked file data redacted', async function (ctx) {
      const error = new Error('agent failed')
      ctx.Agent.promises.createLinkedFile.rejects(error)
      ctx.req.body.data = { url: 'https://example.com/foo?token=secret' }

      await new Promise(resolve => {
        ctx.next = sinon.stub().callsFake(() => resolve())
        ctx.res = { json: () => resolve(), sendStatus: () => resolve() }
        ctx.LinkedFilesController.createLinkedFile(ctx.req, ctx.res, ctx.next)
      })

      expect(ctx.next).to.have.been.calledWith(error)
      expect(ctx.lastLinkedFileWarning()).to.deep.equal({
        error,
        req: ctx.req,
        projectId: ctx.projectId,
        userId: ctx.userId,
        parentFolderId: ctx.parentFolderId,
        linkedFileData: {
          provider: ctx.provider,
          url: 'https://example.com/<redacted>',
          importedAt: ctx.fakeTime.toISOString(),
        },
      })
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
              ctx.userId,
              false
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

    it('logs the failure with the linked file data redacted', async function (ctx) {
      const error = new Error('agent failed')
      ctx.Agent.promises.refreshLinkedFile.rejects(error)
      ctx.file.linkedFileData.url = 'https://example.com/foo?token=secret'

      await new Promise(resolve => {
        ctx.next = sinon.stub().callsFake(() => resolve())
        ctx.res = { json: () => resolve(), sendStatus: () => resolve() }
        ctx.LinkedFilesController.refreshLinkedFile(ctx.req, ctx.res, ctx.next)
      })

      expect(ctx.next).to.have.been.calledWith(error)
      expect(ctx.lastLinkedFileWarning()).to.deep.equal({
        error,
        req: ctx.req,
        projectId: ctx.projectId,
        userId: ctx.userId,
        parentFolderId: 'parent-folder-id',
        linkedFileData: {
          provider: ctx.provider,
          url: 'https://example.com/<redacted>',
          importedAt: ctx.fakeTime.toISOString(),
        },
      })
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
  describe('handleError', function () {
    function redactedDataFor(ctx, linkedFileData) {
      ctx.LinkedFilesController.handleError(
        new Error('agent failed'),
        {},
        linkedFileData,
        {},
        {},
        sinon.stub()
      )
      return ctx.lastLinkedFileWarning().linkedFileData
    }

    it('keeps only the origin of a url', function (ctx) {
      expect(
        redactedDataFor(ctx, {
          provider: 'url',
          url: 'https://example.com/secret/path?token=secret',
        })
      ).to.deep.equal({
        provider: 'url',
        url: 'https://example.com/<redacted>',
      })
    })

    it('reports a url it cannot parse, leaving the input alone', function (ctx) {
      const linkedFileData = { provider: 'url', url: 'not-a-url' }

      expect(redactedDataFor(ctx, linkedFileData)).to.deep.equal({
        provider: 'url',
        url: '<bad input>',
      })
      expect(linkedFileData.url).to.equal('not-a-url')
    })

    it('redacts the build id of an output file', function (ctx) {
      expect(
        redactedDataFor(ctx, {
          provider: 'project_output_file',
          source_project_id: ctx.projectId,
          source_output_file_path: 'output.pdf',
          build_id: '1234abcd-5678ef90',
          clsiServerId: 'clsi-server-id',
        })
      ).to.deep.equal({
        provider: 'project_output_file',
        source_project_id: ctx.projectId,
        source_output_file_path: 'output.pdf',
        build_id: '<redacted>',
        clsiServerId: 'clsi-server-id',
      })
    })

    it('redacts the value of a field it does not know', function (ctx) {
      expect(
        redactedDataFor(ctx, {
          provider: 'project_file',
          source_entity_path: 'refs/linked.bib',
          new_secret_field: 'hunter2',
        })
      ).to.deep.equal({
        provider: 'project_file',
        source_entity_path: 'refs/linked.bib',
        new_secret_field: '<redacted>',
      })
    })
  })
})
