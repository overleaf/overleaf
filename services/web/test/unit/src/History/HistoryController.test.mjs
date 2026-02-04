import { vi, expect } from 'vitest'
import sinon from 'sinon'
import { RequestFailedError } from '@overleaf/fetch-utils'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import mongodb from 'mongodb-legacy'

const { ObjectId } = mongodb

const modulePath = '../../../../app/src/Features/History/HistoryController.mjs'

describe('HistoryController', function () {
  beforeEach(async function (ctx) {
    ctx.callback = sinon.stub()
    ctx.user_id = 'user-id-123'
    ctx.project_id = '000000000000000012345678'
    ctx.blobHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    ctx.stream = sinon.stub()
    ctx.fetchResponse = {
      headers: {
        get: sinon.stub(),
      },
    }
    ctx.next = sinon.stub()

    ctx.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(ctx.user_id),
    }

    ctx.Stream = {
      pipeline: sinon.stub().resolves(),
    }

    ctx.HistoryManager = {
      promises: {
        injectUserDetails: sinon.stub(),
        requestBlobWithProjectId: sinon.stub(),
      },
    }

    ctx.ProjectEntityUpdateHandler = {
      promises: {
        resyncProjectHistory: sinon.stub().resolves(),
      },
    }

    ctx.fetchJson = sinon.stub()
    ctx.fetchStream = sinon.stub().resolves(ctx.stream)
    ctx.fetchStreamWithResponse = sinon
      .stub()
      .resolves({ stream: ctx.stream, response: ctx.fetchResponse })
    ctx.fetchNothing = sinon.stub().resolves()

    vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
      vi.importActual('../../../../app/src/Features/Errors/Errors.js')
    )

    vi.doMock('stream/promises', () => ctx.Stream)

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {}),
    }))

    vi.doMock('@overleaf/fetch-utils', () => ({
      fetchJson: ctx.fetchJson,
      fetchStream: ctx.fetchStream,
      fetchStreamWithResponse: ctx.fetchStreamWithResponse,
      fetchNothing: ctx.fetchNothing,
    }))

    vi.doMock('@overleaf/Metrics', () => ({
      default: {},
    }))

    vi.doMock('../../../../app/src/infrastructure/mongodb.mjs', () => ({
      default: { ObjectId },
    }))

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager.mjs',
      () => ({
        default: ctx.SessionManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/History/HistoryManager.mjs',
      () => ({
        default: ctx.HistoryManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectDetailsHandler.mjs',
      () => ({
        default: (ctx.ProjectDetailsHandler = {}),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEntityUpdateHandler.mjs',
      () => ({
        default: ctx.ProjectEntityUpdateHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectAuditLogHandler.mjs',
      () => ({
        default: (ctx.ProjectAuditLogHandler = {
          addEntryIfManagedInBackground: sinon.stub(),
        }),
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserGetter.mjs', () => ({
      default: (ctx.UserGetter = {}),
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter.mjs', () => ({
      default: (ctx.ProjectGetter = {}),
    }))

    vi.doMock(
      '../../../../app/src/Features/History/RestoreManager.mjs',
      () => ({
        default: (ctx.RestoreManager = {}),
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Features.mjs', () => ({
      default: (ctx.Features = sinon.stub().withArgs('saas').returns(true)),
    }))

    ctx.HistoryController = (await import(modulePath)).default
    ctx.settings.apis = {
      project_history: {
        url: 'http://project_history.example.com',
      },
    }
  })

  describe('proxyToHistoryApi', function () {
    beforeEach(async function (ctx) {
      ctx.req = { url: '/mock/url', method: 'POST', session: sinon.stub() }
      ctx.res = {
        set: sinon.stub(),
      }
      ctx.contentType = 'application/json'
      ctx.contentLength = 212
      ctx.fetchResponse.headers.get
        .withArgs('Content-Type')
        .returns(ctx.contentType)
      ctx.fetchResponse.headers.get
        .withArgs('Content-Length')
        .returns(ctx.contentLength)
      await ctx.HistoryController.proxyToHistoryApi(ctx.req, ctx.res, ctx.next)
    })

    it('should get the user id', function (ctx) {
      ctx.SessionManager.getLoggedInUserId.should.have.been.calledWith(
        ctx.req.session
      )
    })

    it('should call the project history api', function (ctx) {
      ctx.fetchStreamWithResponse.should.have.been.calledWith(
        `${ctx.settings.apis.project_history.url}${ctx.req.url}`,
        {
          method: ctx.req.method,
          headers: {
            'X-User-Id': ctx.user_id,
          },
        }
      )
    })

    it('should pipe the response to the client', function (ctx) {
      expect(ctx.Stream.pipeline).to.have.been.calledWith(ctx.stream, ctx.res)
    })

    it('should propagate the appropriate headers', function (ctx) {
      expect(ctx.res.set).to.have.been.calledWith(
        'Content-Type',
        ctx.contentType
      )
      expect(ctx.res.set).to.have.been.calledWith(
        'Content-Length',
        ctx.contentLength
      )
    })
  })

  describe('proxyToHistoryApiAndInjectUserDetails', function () {
    beforeEach(async function (ctx) {
      ctx.req = { url: '/mock/url', method: 'POST' }
      ctx.res = { json: sinon.stub() }
      ctx.data = 'mock-data'
      ctx.dataWithUsers = 'mock-injected-data'
      ctx.fetchJson.resolves(ctx.data)
      ctx.HistoryManager.promises.injectUserDetails.resolves(ctx.dataWithUsers)
      await ctx.HistoryController.proxyToHistoryApiAndInjectUserDetails(
        ctx.req,
        ctx.res,
        ctx.next
      )
    })

    it('should get the user id', function (ctx) {
      ctx.SessionManager.getLoggedInUserId.should.have.been.calledWith(
        ctx.req.session
      )
    })

    it('should call the project history api', function (ctx) {
      ctx.fetchJson.should.have.been.calledWith(
        `${ctx.settings.apis.project_history.url}${ctx.req.url}`,
        {
          method: ctx.req.method,
          headers: {
            'X-User-Id': ctx.user_id,
          },
        }
      )
    })

    it('should inject the user data', function (ctx) {
      ctx.HistoryManager.promises.injectUserDetails.should.have.been.calledWith(
        ctx.data
      )
    })

    it('should return the data with users to the client', function (ctx) {
      ctx.res.json.should.have.been.calledWith(ctx.dataWithUsers)
    })
  })

  describe('proxyToHistoryApiAndInjectUserDetails (with the history API failing)', function () {
    beforeEach(async function (ctx) {
      ctx.url = '/mock/url'
      ctx.req = { url: ctx.url, method: 'POST' }
      ctx.res = { json: sinon.stub() }
      ctx.err = new RequestFailedError(ctx.url, {}, { status: 500 })
      ctx.fetchJson.rejects(ctx.err)
      await ctx.HistoryController.proxyToHistoryApiAndInjectUserDetails(
        ctx.req,
        ctx.res,
        ctx.next
      )
    })

    it('should not inject the user data', function (ctx) {
      ctx.HistoryManager.promises.injectUserDetails.should.not.have.been.called
    })

    it('should not return the data with users to the client', function (ctx) {
      ctx.res.json.should.not.have.been.called
    })

    it('should throw an error', function (ctx) {
      ctx.next.should.have.been.calledWith(ctx.err)
    })
  })

  describe('resyncProjectHistory', function () {
    describe('for a project without project-history enabled', function () {
      beforeEach(async function (ctx) {
        ctx.req = { params: { Project_id: ctx.project_id }, body: {} }
        ctx.res = { setTimeout: sinon.stub(), sendStatus: sinon.stub() }

        ctx.error = new Errors.ProjectHistoryDisabledError()
        ctx.ProjectEntityUpdateHandler.promises.resyncProjectHistory.rejects(
          ctx.error
        )

        await ctx.HistoryController.resyncProjectHistory(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('response with a 404', function (ctx) {
        ctx.res.sendStatus.should.have.been.calledWith(404)
      })
    })

    describe('for a project with project-history enabled', function () {
      beforeEach(async function (ctx) {
        ctx.req = { params: { Project_id: ctx.project_id }, body: {} }
        ctx.res = { setTimeout: sinon.stub(), sendStatus: sinon.stub() }

        await ctx.HistoryController.resyncProjectHistory(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('sets an extended response timeout', function (ctx) {
        ctx.res.setTimeout.should.have.been.calledWith(6 * 60 * 1000)
      })

      it('resyncs the project', function (ctx) {
        ctx.ProjectEntityUpdateHandler.promises.resyncProjectHistory.should.have.been.calledWith(
          ctx.project_id
        )
      })

      it('responds with a 204', function (ctx) {
        ctx.res.sendStatus.should.have.been.calledWith(204)
      })
    })
  })

  describe('requestBlob', function () {
    describe('With Range header', function () {
      beforeEach(async function (ctx) {
        ctx.req = {
          params: {
            project_id: ctx.project_id,
            hash: ctx.blobHash,
          },
          query: {},
          body: {},
          get: sinon.stub(),
        }
        ctx.req.get.withArgs('Range').returns('bytes=0-42')
        ctx.res = { setHeader: sinon.stub(), status: sinon.stub() }
        ctx.HistoryManager.promises.requestBlobWithProjectId.resolves({
          stream: null,
          contentLength: '43',
          contentRange: 'bytes 0-42/100',
        })
        await ctx.HistoryController.getBlob(ctx.req, ctx.res, ctx.next)
      })

      it('should forward the range request', function (ctx) {
        ctx.HistoryManager.promises.requestBlobWithProjectId.should.have.been.calledWith(
          sinon.match(val => val.toString() === ctx.project_id),
          ctx.blobHash,
          'GET',
          'bytes=0-42'
        )
      })

      it('should forward the Content-Range header', function (ctx) {
        ctx.res.setHeader.should.have.been.calledWith(
          'Content-Range',
          'bytes 0-42/100'
        )
      })

      it('should forward the Content-Length header', function (ctx) {
        ctx.res.setHeader.should.have.been.calledWith('Content-Length', '43')
      })

      it('should have status 206', function (ctx) {
        ctx.res.status.should.have.been.calledWith(206)
      })
    })

    describe('Without Range header', function () {
      beforeEach(async function (ctx) {
        ctx.req = {
          params: {
            project_id: ctx.project_id,
            hash: ctx.blobHash,
          },
          query: {},
          body: {},
          get: sinon.stub(),
        }
        ctx.req.get.withArgs('Range').returns(null)
        ctx.res = { setHeader: sinon.stub(), status: sinon.stub() }
        ctx.HistoryManager.promises.requestBlobWithProjectId.resolves({
          stream: null,
          contentLength: '100',
          range: null,
        })
        await ctx.HistoryController.getBlob(ctx.req, ctx.res, ctx.next)
      })

      it('should not have a Content-Range header', function (ctx) {
        expect(ctx.res.setHeader).to.not.have.been.calledWith(
          'Content-Range',
          sinon.match.string
        )
      })

      it('should forward the Content-Length header', function (ctx) {
        ctx.res.setHeader.should.have.been.calledWith('Content-Length', '100')
      })

      it('should not have status 206', function (ctx) {
        ctx.res.status.should.not.have.been.calledWith(206)
      })
    })
  })
})
