import { beforeEach, describe, expect, it, vi } from 'vitest'
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
        default: (ctx.RestoreManager = {
          promises: {
            restoreFileFromV2: sinon
              .stub()
              .resolves({ _id: 'restored-id', type: 'doc' }),
            revertFile: sinon
              .stub()
              .resolves({ _id: 'reverted-id', type: 'doc' }),
            revertProject: sinon.stub().resolves([]),
          },
        }),
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
      ctx.req = {
        url: '/mock/url',
        method: 'POST',
        session: sinon.stub(),
        params: {},
      }
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

  describe('proxyToHistoryApi (with an invalid request)', function () {
    beforeEach(async function (ctx) {
      ctx.req = {
        url: '/mock/url',
        method: 'GET',
        session: sinon.stub(),
        params: { Project_id: 'not-an-object-id' },
      }
      ctx.res = { set: sinon.stub() }
      await ctx.HistoryController.proxyToHistoryApi(ctx.req, ctx.res, ctx.next)
    })

    it('rejects the request without calling the history api', function (ctx) {
      ctx.next.should.have.been.calledOnce
      ctx.next.firstCall.args[0].should.be.an.instanceof(Error)
      ctx.fetchStreamWithResponse.should.not.have.been.called
    })
  })

  describe('proxyToHistoryApiAndInjectUserDetails', function () {
    beforeEach(async function (ctx) {
      ctx.req = {
        url: '/mock/url',
        method: 'POST',
        params: { Project_id: ctx.project_id },
      }
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
      ctx.req = {
        url: ctx.url,
        method: 'POST',
        params: { Project_id: ctx.project_id },
      }
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

  describe('proxyToHistoryApiAndInjectUserDetails (with an invalid request)', function () {
    beforeEach(async function (ctx) {
      ctx.req = {
        url: '/mock/url',
        method: 'GET',
        params: { Project_id: 'not-an-object-id' },
      }
      ctx.res = { json: sinon.stub() }
      await ctx.HistoryController.proxyToHistoryApiAndInjectUserDetails(
        ctx.req,
        ctx.res,
        ctx.next
      )
    })

    it('rejects the request without calling the history api', function (ctx) {
      ctx.next.should.have.been.calledOnce
      ctx.next.firstCall.args[0].should.be.an.instanceof(Error)
      ctx.fetchJson.should.not.have.been.called
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

    describe('with an invalid historyRangesMigration value', function () {
      beforeEach(async function (ctx) {
        ctx.req = {
          params: { Project_id: ctx.project_id },
          body: { historyRangesMigration: 'sideways' },
        }
        ctx.res = { setTimeout: sinon.stub(), sendStatus: sinon.stub() }

        await ctx.HistoryController.resyncProjectHistory(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('rejects the request without resyncing', function (ctx) {
        ctx.next.should.have.been.calledOnce
        ctx.next.firstCall.args[0].should.be.an.instanceof(Error)
        ctx.ProjectEntityUpdateHandler.promises.resyncProjectHistory.should.not
          .have.been.called
      })
    })
  })

  describe('restoreFileFromV2', function () {
    beforeEach(function (ctx) {
      ctx.res = { json: sinon.stub() }
      ctx.ProjectAuditLogHandler.addEntryIfManagedInBackground = sinon.stub()
    })

    it('restores the file for a valid request', async function (ctx) {
      ctx.req = {
        params: { project_id: ctx.project_id },
        body: { version: 42, pathname: 'foo/bar.tex' },
        session: {},
        ip: '1.2.3.4',
      }
      await ctx.HistoryController.restoreFileFromV2(ctx.req, ctx.res, ctx.next)
      ctx.RestoreManager.promises.restoreFileFromV2.should.have.been.calledWith(
        ctx.user_id,
        ctx.project_id,
        42,
        'foo/bar.tex'
      )
    })

    it('rejects a non-numeric version without invoking RestoreManager', async function (ctx) {
      ctx.req = {
        params: { project_id: ctx.project_id },
        body: { version: 'not-a-number', pathname: 'foo/bar.tex' },
        session: {},
        ip: '1.2.3.4',
      }
      await ctx.HistoryController.restoreFileFromV2(ctx.req, ctx.res, ctx.next)
      ctx.next.should.have.been.calledOnce
      ctx.next.firstCall.args[0].should.be.an.instanceof(Error)
      ctx.RestoreManager.promises.restoreFileFromV2.should.not.have.been.called
    })

    it('rejects a negative version without invoking RestoreManager', async function (ctx) {
      ctx.req = {
        params: { project_id: ctx.project_id },
        body: { version: -1, pathname: 'foo/bar.tex' },
        session: {},
        ip: '1.2.3.4',
      }
      await ctx.HistoryController.restoreFileFromV2(ctx.req, ctx.res, ctx.next)
      ctx.next.should.have.been.calledOnce
      ctx.next.firstCall.args[0].should.be.an.instanceof(Error)
      ctx.RestoreManager.promises.restoreFileFromV2.should.not.have.been.called
    })

    it('rejects a pathname containing .. without invoking RestoreManager', async function (ctx) {
      ctx.req = {
        params: { project_id: ctx.project_id },
        body: { version: 42, pathname: '../../etc/passwd' },
        session: {},
        ip: '1.2.3.4',
      }
      await ctx.HistoryController.restoreFileFromV2(ctx.req, ctx.res, ctx.next)
      ctx.next.should.have.been.calledOnce
      ctx.next.firstCall.args[0].should.be.an.instanceof(Error)
      ctx.RestoreManager.promises.restoreFileFromV2.should.not.have.been.called
    })

    it('rejects an absolute pathname without invoking RestoreManager', async function (ctx) {
      ctx.req = {
        params: { project_id: ctx.project_id },
        body: { version: 42, pathname: '/etc/passwd' },
        session: {},
        ip: '1.2.3.4',
      }
      await ctx.HistoryController.restoreFileFromV2(ctx.req, ctx.res, ctx.next)
      ctx.next.should.have.been.calledOnce
      ctx.next.firstCall.args[0].should.be.an.instanceof(Error)
      ctx.RestoreManager.promises.restoreFileFromV2.should.not.have.been.called
    })

    it('rejects a path-traversal string as version without invoking RestoreManager', async function (ctx) {
      ctx.req = {
        params: { project_id: ctx.project_id },
        body: { version: '0/../../../ObjectId', pathname: 'foo/bar.tex' },
        session: {},
        ip: '1.2.3.4',
      }
      await ctx.HistoryController.restoreFileFromV2(ctx.req, ctx.res, ctx.next)
      ctx.next.should.have.been.calledOnce
      ctx.next.firstCall.args[0].should.be.an.instanceof(Error)
      ctx.RestoreManager.promises.restoreFileFromV2.should.not.have.been.called
    })
  })

  describe('revertFile', function () {
    beforeEach(function (ctx) {
      ctx.res = { json: sinon.stub() }
      ctx.ProjectAuditLogHandler.addEntryIfManagedInBackground = sinon.stub()
    })

    it('reverts the file for a valid request', async function (ctx) {
      ctx.req = {
        params: { project_id: ctx.project_id },
        body: { version: 42, pathname: 'foo/bar.tex' },
        session: {},
        ip: '1.2.3.4',
      }
      await ctx.HistoryController.revertFile(ctx.req, ctx.res, ctx.next)
      ctx.RestoreManager.promises.revertFile.should.have.been.calledWith(
        ctx.user_id,
        ctx.project_id,
        42,
        'foo/bar.tex'
      )
    })

    it('rejects a malformed pathname without invoking RestoreManager', async function (ctx) {
      ctx.req = {
        params: { project_id: ctx.project_id },
        body: { version: 42, pathname: '../secret.tex' },
        session: {},
        ip: '1.2.3.4',
      }
      await ctx.HistoryController.revertFile(ctx.req, ctx.res, ctx.next)
      ctx.next.should.have.been.calledOnce
      ctx.next.firstCall.args[0].should.be.an.instanceof(Error)
      ctx.RestoreManager.promises.revertFile.should.not.have.been.called
    })
  })

  describe('revertProject', function () {
    beforeEach(function (ctx) {
      ctx.res = { json: sinon.stub() }
      ctx.ProjectAuditLogHandler.addEntryIfManagedInBackground = sinon.stub()
    })

    it('reverts the project for a valid request', async function (ctx) {
      ctx.req = {
        params: { project_id: ctx.project_id },
        body: { version: 42 },
        session: {},
        ip: '1.2.3.4',
      }
      await ctx.HistoryController.revertProject(ctx.req, ctx.res, ctx.next)
      ctx.RestoreManager.promises.revertProject.should.have.been.calledWith(
        ctx.user_id,
        ctx.project_id,
        42
      )
    })

    it('rejects a non-integer version without invoking RestoreManager', async function (ctx) {
      ctx.req = {
        params: { project_id: ctx.project_id },
        body: { version: 1.5 },
        session: {},
        ip: '1.2.3.4',
      }
      await ctx.HistoryController.revertProject(ctx.req, ctx.res, ctx.next)
      ctx.next.should.have.been.calledOnce
      ctx.next.firstCall.args[0].should.be.an.instanceof(Error)
      ctx.RestoreManager.promises.revertProject.should.not.have.been.called
    })
  })

  describe('getLabels', function () {
    beforeEach(function (ctx) {
      ctx.res = { json: sinon.stub() }
      ctx.labels = [{ id: 'label-1', comment: 'a label' }]
      ctx.fetchJson.resolves(ctx.labels)
    })

    it('fetches and returns the labels for a valid request', async function (ctx) {
      ctx.req = { params: { Project_id: ctx.project_id } }
      await ctx.HistoryController.getLabels(ctx.req, ctx.res, ctx.next)
      ctx.fetchJson.should.have.been.calledWith(
        `${ctx.settings.apis.project_history.url}/project/${ctx.project_id}/labels`
      )
      ctx.res.json.should.have.been.calledWith(ctx.labels)
    })

    it('rejects a malformed Project_id without calling the history api', async function (ctx) {
      ctx.req = { params: { Project_id: 'not-an-object-id' } }
      await ctx.HistoryController.getLabels(ctx.req, ctx.res, ctx.next)
      ctx.next.should.have.been.calledOnce
      ctx.next.firstCall.args[0].should.be.an.instanceof(Error)
      ctx.fetchJson.should.not.have.been.called
    })
  })

  describe('createLabel', function () {
    beforeEach(function (ctx) {
      ctx.res = { json: sinon.stub() }
    })

    it('creates and returns the label for a valid request', async function (ctx) {
      ctx.req = {
        params: { Project_id: ctx.project_id },
        body: { comment: 'a label', version: 3 },
        session: {},
      }
      ctx.label = { id: 'label-1', comment: 'a label', version: 3 }
      ctx.fetchJson.resolves(ctx.label)
      await ctx.HistoryController.createLabel(ctx.req, ctx.res, ctx.next)
      ctx.fetchJson.should.have.been.calledWith(
        `${ctx.settings.apis.project_history.url}/project/${ctx.project_id}/labels`,
        {
          method: 'POST',
          json: { comment: 'a label', version: 3, user_id: ctx.user_id },
        }
      )
      ctx.res.json.should.have.been.calledWith(
        sinon.match({ comment: 'a label', version: 3 })
      )
    })

    it('rejects a negative version without calling the history api', async function (ctx) {
      ctx.req = {
        params: { Project_id: ctx.project_id },
        body: { comment: 'a label', version: -1 },
        session: {},
      }
      await ctx.HistoryController.createLabel(ctx.req, ctx.res, ctx.next)
      ctx.next.should.have.been.calledOnce
      ctx.next.firstCall.args[0].should.be.an.instanceof(Error)
      ctx.fetchJson.should.not.have.been.called
    })
  })

  describe('deleteLabel', function () {
    beforeEach(function (ctx) {
      ctx.res = { sendStatus: sinon.stub() }
      ctx.labelId = '000000000000000087654321'
      ctx.ProjectGetter.promises = {
        getProject: sinon.stub().resolves({
          owner_ref: { equals: sinon.stub().returns(true) },
        }),
      }
    })

    it('deletes the label for a valid request', async function (ctx) {
      ctx.req = {
        params: { Project_id: ctx.project_id, label_id: ctx.labelId },
        session: {},
      }
      await ctx.HistoryController.deleteLabel(ctx.req, ctx.res, ctx.next)
      ctx.fetchNothing.should.have.been.calledWith(
        `${ctx.settings.apis.project_history.url}/project/${ctx.project_id}/labels/${ctx.labelId}`,
        { method: 'DELETE' }
      )
      ctx.res.sendStatus.should.have.been.calledWith(204)
    })

    it('rejects a malformed label_id without calling the history api', async function (ctx) {
      ctx.req = {
        params: { Project_id: ctx.project_id, label_id: 'not-an-object-id' },
        session: {},
      }
      await ctx.HistoryController.deleteLabel(ctx.req, ctx.res, ctx.next)
      ctx.next.should.have.been.calledOnce
      ctx.next.firstCall.args[0].should.be.an.instanceof(Error)
      ctx.fetchNothing.should.not.have.been.called
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
