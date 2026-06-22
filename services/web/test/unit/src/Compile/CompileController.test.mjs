import { vi, expect } from 'vitest'
import sinon from 'sinon'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'
import { Headers } from 'node-fetch'
import { ReadableString } from '@overleaf/stream-utils'
import { RequestFailedError } from '@overleaf/fetch-utils'
import { asZodError } from '@overleaf/validation-tools/testUtils.js'

const modulePath = '../../../../app/src/Features/Compile/CompileController.mjs'

describe('CompileController', function () {
  beforeEach(async function (ctx) {
    ctx.user_id = 'aaaaaaaaaaaaaaaaaaaaaaaa'
    ctx.user = {
      _id: ctx.user_id,
      email: 'user@example.com',
      features: {
        compileGroup: 'premium',
        compileTimeout: 100,
      },
    }
    ctx.ClsiCacheController = {
      _downloadFromCacheWithParams: sinon.stub().resolves(),
    }
    ctx.CompileManager = {
      promises: {
        compile: sinon.stub(),
        getProjectCompileLimits: sinon.stub().resolves({
          compileBackendClass: 'free',
          compileGroup: 'standard',
        }),
        syncTeX: sinon.stub(),
      },
    }
    ctx.ClsiManager = {
      promises: {},
    }
    ctx.UserGetter = { getUser: sinon.stub() }
    ctx.rateLimiter = {
      consume: sinon.stub().resolves(),
    }
    ctx.RateLimiter = {
      RateLimiter: sinon.stub().returns(ctx.rateLimiter),
    }
    ctx.settings = {
      apis: {
        clsi: {
          url: 'http://clsi.example.com:3013',
          downloadHost: 'http://clsi.example.com:8080',
          submissionCompileBackendClass: 'free',
        },
        clsi_priority: {
          url: 'http://clsi-priority.example.com',
        },
      },
      defaultFeatures: {
        compileGroup: 'standard',
        compileTimeout: 60,
      },
      clsiCookie: {
        key: 'cookie-key',
      },
      moduleImportSequence: [],
      overleaf: {},
    }
    ctx.ClsiCookieManager = {
      promises: {
        getServerId: sinon.stub().resolves('clsi-server-id-from-redis'),
      },
    }
    ctx.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(ctx.user_id),
      getSessionUser: sinon.stub().returns(ctx.user),
      isUserLoggedIn: sinon.stub().returns(true),
    }
    ctx.pipeline = sinon.stub().callsFake(async (stream, res) => {
      if (res.callback) res.callback()
    })
    ctx.clsiStream = new ReadableString('{}')
    ctx.clsiResponse = {
      headers: new Headers({
        'Content-Length': '2',
        'Content-Type': 'application/json',
      }),
    }
    ctx.fetchUtils = {
      fetchStreamWithResponse: sinon.stub().resolves({
        stream: ctx.clsiStream,
        response: ctx.clsiResponse,
      }),
      RequestFailedError,
    }

    vi.doMock('stream/promises', () => ({
      pipeline: ctx.pipeline,
    }))

    ctx.Metrics = {
      inc: sinon.stub(),
      Timer: sinon.stub().returns({ done: sinon.stub(), labels: {} }),
    }
    vi.doMock('@overleaf/metrics', () => ({ default: ctx.Metrics }))

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('@overleaf/fetch-utils', () => ctx.fetchUtils)

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: (ctx.ProjectGetter = {
        promises: {},
      }),
    }))

    vi.doMock(
      '../../../../app/src/Features/Compile/ClsiCacheController',
      () => ({
        default: ctx.ClsiCacheController,
      })
    )

    vi.doMock('../../../../app/src/Features/Compile/CompileManager', () => ({
      default: ctx.CompileManager,
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock('../../../../app/src/Features/Compile/ClsiManager', () => ({
      default: ctx.ClsiManager,
    }))

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: ctx.SessionManager,
      })
    )

    vi.doMock(
      '../../../../app/src/infrastructure/RateLimiter.mjs',
      () => ctx.RateLimiter
    )

    vi.doMock('../../../../app/src/Features/Compile/ClsiCookieManager', () => ({
      default: () => ctx.ClsiCookieManager,
    }))

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler',
      () => ({
        default: {
          featureFlagEnabled: (ctx.featureFlagEnabled = sinon
            .stub()
            .yields(null, false)),
          promises: {
            featureFlagEnabled: sinon.stub().resolves(false),
          },
        },
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({
        default: {
          recordEventForSession: sinon.stub(),
        },
      })
    )

    ctx.CompileController = (await import(modulePath)).default
    ctx.projectId = 'abc123def456abc123def456'
    ctx.build_id = '18fbe9e7564-30dcb2f71250c690'
    ctx.next = sinon.stub().callsFake(err => {
      // Flag unexpected next calls.
      throw err
    })
    ctx.req = new MockRequest(vi)
    ctx.res = new MockResponse(vi)
    ctx.res = new MockResponse(vi)
  })

  describe('compile', function () {
    beforeEach(function (ctx) {
      ctx.req.params = { Project_id: ctx.projectId }
      ctx.req.session = {}
      ctx.CompileManager.promises.compile = sinon.stub().resolves({
        status: (ctx.status = 'success'),
        outputFiles: (ctx.outputFiles = [
          {
            path: 'output.pdf',
            url: `/project/${ctx.projectId}/user/${ctx.user_id}/build/id/output.pdf`,
            type: 'pdf',
          },
        ]),
        clsiServerId: undefined,
        limits: undefined,
        validationProblems: undefined,
        stats: undefined,
        timings: undefined,
        outputUrlPrefix: undefined,
        buildId: ctx.build_id,
      })
    })

    describe('pdfDownloadDomain', function () {
      beforeEach(function (ctx) {
        ctx.settings.pdfDownloadDomain = 'https://compiles.overleaf.test'
      })

      describe('when clsi does not emit zone prefix', function () {
        beforeEach(async function (ctx) {
          await ctx.CompileController.compile(ctx.req, ctx.res, ctx.next)
        })

        it('should add domain verbatim', function (ctx) {
          ctx.res.statusCode.should.equal(200)
          ctx.res.body.should.equal(
            JSON.stringify({
              status: ctx.status,
              outputFiles: [
                {
                  path: 'output.pdf',
                  url: `/project/${ctx.projectId}/user/${ctx.user_id}/build/id/output.pdf`,
                  type: 'pdf',
                },
              ],
              outputFilesArchive: {
                path: 'output.zip',
                url: `/project/${ctx.projectId}/user/${ctx.user_id}/build/${ctx.build_id}/output/output.zip`,
                type: 'zip',
              },
              pdfDownloadDomain: 'https://compiles.overleaf.test',
            })
          )
        })
      })

      describe('when clsi emits a zone prefix', function () {
        beforeEach(async function (ctx) {
          ctx.CompileManager.promises.compile = sinon.stub().resolves({
            status: (ctx.status = 'success'),
            outputFiles: (ctx.outputFiles = [
              {
                path: 'output.pdf',
                url: `/project/${ctx.projectId}/user/${ctx.user_id}/build/id/output.pdf`,
                type: 'pdf',
              },
            ]),
            clsiServerId: undefined,
            limits: undefined,
            validationProblems: undefined,
            stats: undefined,
            timings: undefined,
            outputUrlPrefix: '/zone/b',
            buildId: ctx.build_id,
          })
          await ctx.CompileController.compile(ctx.req, ctx.res, ctx.next)
        })

        it('should add the zone prefix', function (ctx) {
          ctx.res.statusCode.should.equal(200)
          ctx.res.body.should.equal(
            JSON.stringify({
              status: ctx.status,
              outputFiles: [
                {
                  path: 'output.pdf',
                  url: `/project/${ctx.projectId}/user/${ctx.user_id}/build/id/output.pdf`,
                  type: 'pdf',
                },
              ],
              outputFilesArchive: {
                path: 'output.zip',
                url: `/project/${ctx.projectId}/user/${ctx.user_id}/build/${ctx.build_id}/output/output.zip`,
                type: 'zip',
              },
              outputUrlPrefix: '/zone/b',
              pdfDownloadDomain: 'https://compiles.overleaf.test/zone/b',
            })
          )
        })
      })
    })

    describe('when not an auto compile', function () {
      beforeEach(async function (ctx) {
        await ctx.CompileController.compile(ctx.req, ctx.res, ctx.next)
      })

      it('should look up the user id', function (ctx) {
        ctx.SessionManager.getLoggedInUserId
          .calledWith(ctx.req.session)
          .should.equal(true)
      })

      it('should do the compile without the auto compile flag', function (ctx) {
        expect(ctx.CompileManager.promises.compile).to.have.been.calledWith(
          ctx.projectId,
          ctx.user_id,
          {
            isAutoCompile: false,
            compileFromClsiCache: true,
            populateClsiCache: true,
            compileFromHistory: false,
            enablePdfCaching: false,
            fileLineErrors: false,
            stopOnFirstError: false,
            editorId: undefined,
            rootResourcePath: undefined,
          }
        )
      })

      it('should set the content-type of the response to application/json', function (ctx) {
        ctx.res.type.should.equal('application/json')
      })

      it('should send a successful response reporting the status and files', function (ctx) {
        ctx.res.statusCode.should.equal(200)
        ctx.res.body.should.equal(
          JSON.stringify({
            status: ctx.status,
            outputFiles: ctx.outputFiles,
            outputFilesArchive: {
              path: 'output.zip',
              url: `/project/${ctx.projectId}/user/${ctx.user_id}/build/${ctx.build_id}/output/output.zip`,
              type: 'zip',
            },
          })
        )
      })
    })

    describe('when an auto compile', function () {
      beforeEach(async function (ctx) {
        ctx.req.query = { auto_compile: 'true' }
        await ctx.CompileController.compile(ctx.req, ctx.res, ctx.next)
      })

      it('should do the compile with the auto compile flag', function (ctx) {
        ctx.CompileManager.promises.compile.should.have.been.calledWith(
          ctx.projectId,
          ctx.user_id,
          {
            isAutoCompile: true,
            compileFromClsiCache: true,
            populateClsiCache: true,
            compileFromHistory: false,
            enablePdfCaching: false,
            fileLineErrors: false,
            stopOnFirstError: false,
            editorId: undefined,
            rootResourcePath: undefined,
          }
        )
      })
    })

    describe('with the draft attribute', function () {
      beforeEach(async function (ctx) {
        ctx.req.body = { draft: true }
        await ctx.CompileController.compile(ctx.req, ctx.res, ctx.next)
      })

      it('should do the compile without the draft compile flag', function (ctx) {
        ctx.CompileManager.promises.compile.should.have.been.calledWith(
          ctx.projectId,
          ctx.user_id,
          {
            isAutoCompile: false,
            compileFromClsiCache: true,
            populateClsiCache: true,
            compileFromHistory: false,
            enablePdfCaching: false,
            draft: true,
            fileLineErrors: false,
            stopOnFirstError: false,
            editorId: undefined,
            rootResourcePath: undefined,
          }
        )
      })
    })

    describe('with an editor id', function () {
      beforeEach(async function (ctx) {
        ctx.req.body = { editorId: 'the-editor-id' }
        await ctx.CompileController.compile(ctx.req, ctx.res, ctx.next)
      })

      it('should pass the editor id to the compiler', function (ctx) {
        ctx.CompileManager.promises.compile.should.have.been.calledWith(
          ctx.projectId,
          ctx.user_id,
          {
            isAutoCompile: false,
            compileFromClsiCache: true,
            populateClsiCache: true,
            compileFromHistory: false,
            enablePdfCaching: false,
            fileLineErrors: false,
            stopOnFirstError: false,
            editorId: 'the-editor-id',
            rootResourcePath: undefined,
          }
        )
      })
    })
    describe('with a rootResourcePath', function () {
      beforeEach(async function (ctx) {
        ctx.req.body = { rootResourcePath: 'foo.tex' }
        await ctx.CompileController.compile(ctx.req, ctx.res, ctx.next)
      })

      it('should pass the rootResourcePath to the compiler', function (ctx) {
        ctx.CompileManager.promises.compile.should.have.been.calledWith(
          ctx.projectId,
          ctx.user_id,
          {
            isAutoCompile: false,
            compileFromClsiCache: true,
            populateClsiCache: true,
            compileFromHistory: false,
            enablePdfCaching: false,
            fileLineErrors: false,
            stopOnFirstError: false,
            editorId: undefined,
            rootResourcePath: 'foo.tex',
          }
        )
      })
    })
  })

  describe('compileSubmission', function () {
    beforeEach(function (ctx) {
      ctx.submission_id = 'sub-1234'
      ctx.req.params = { submission_id: ctx.submission_id }
      ctx.req.body = {}
      ctx.ClsiManager.promises.sendExternalRequest = sinon.stub().resolves({
        status: (ctx.status = 'success'),
        outputFiles: (ctx.outputFiles = ['mock-output-files']),
        clsiServerId: 'mock-server-id',
        validationProblems: null,
      })
    })

    it('should set the content-type of the response to application/json', async function (ctx) {
      await ctx.CompileController.compileSubmission(ctx.req, ctx.res, ctx.next)
      expect(ctx.res.contentType).toBeCalledWith('application/json')
    })

    it('should send a successful response reporting the status and files', async function (ctx) {
      await ctx.CompileController.compileSubmission(ctx.req, ctx.res, ctx.next)
      ctx.res.statusCode.should.equal(200)
      ctx.res.body.should.equal(
        JSON.stringify({
          status: ctx.status,
          outputFiles: ctx.outputFiles,
          clsiServerId: 'mock-server-id',
          validationProblems: null,
        })
      )
    })

    describe('with compileGroup and timeout', function () {
      beforeEach(function (ctx) {
        ctx.req.body = {
          compileGroup: 'special',
          timeout: 600,
        }
        ctx.CompileController.compileSubmission(ctx.req, ctx.res, ctx.next)
      })

      it('should use the supplied values', function (ctx) {
        ctx.ClsiManager.promises.sendExternalRequest.should.have.been.calledWith(
          ctx.submission_id,
          { compileGroup: 'special', timeout: 600 },
          { compileGroup: 'special', compileBackendClass: 'free', timeout: 600 }
        )
      })
    })

    describe('with other supported options but not compileGroup and timeout', function () {
      beforeEach(function (ctx) {
        ctx.req.body = {
          rootResourcePath: 'main.tex',
          compiler: 'lualatex',
          draft: true,
          check: 'validate',
        }
        ctx.CompileController.compileSubmission(ctx.req, ctx.res, ctx.next)
      })

      it('should use the other options but default values for compileGroup and timeout', function (ctx) {
        ctx.ClsiManager.promises.sendExternalRequest.should.have.been.calledWith(
          ctx.submission_id,
          {
            rootResourcePath: 'main.tex',
            compiler: 'lualatex',
            draft: true,
            check: 'validate',
          },
          {
            rootResourcePath: 'main.tex',
            compiler: 'lualatex',
            draft: true,
            check: 'validate',
            compileGroup: 'standard',
            compileBackendClass: 'free',
            timeout: 60,
          }
        )
      })
    })
  })

  describe('downloadPdf', function () {
    beforeEach(function (ctx) {
      ctx.clsiServerId = 'clsi-server-1'
      ctx.req.params = {
        Project_id: ctx.projectId,
        build_id: ctx.build_id,
      }
      ctx.req.query = { clsiserverid: ctx.clsiServerId }
      ctx.req.session = {}
      ctx.project = { name: 'test namè; 1' }
      ctx.ProjectGetter.promises.getProject = sinon.stub().resolves(ctx.project)
    })

    describe('logged-in', function () {
      beforeEach(async function (ctx) {
        await ctx.CompileController.downloadPdf(ctx.req, ctx.res, ctx.next)
      })

      it('should look up the project', function (ctx) {
        ctx.ProjectGetter.promises.getProject
          .calledWith(ctx.projectId, { name: 1 })
          .should.equal(true)
      })

      it('should set the content-type of the response to application/pdf', function (ctx) {
        expect(ctx.res.contentType).toBeCalledWith('application/pdf')
      })

      it('should set the content-disposition header with a safe version of the project name', function (ctx) {
        expect(ctx.res.setContentDisposition).toBeCalledWith('inline', {
          filename: 'test_namè__1.pdf',
        })
      })

      it('should increment the pdf-downloads metric', function (ctx) {
        ctx.Metrics.inc.calledWith('pdf-downloads').should.equal(true)
      })

      it('should proxy the PDF from the CLSI', function (ctx) {
        ctx.fetchUtils.fetchStreamWithResponse.should.have.been.calledWith(
          `${ctx.settings.apis.clsi.downloadHost}/project/${ctx.projectId}/user/${ctx.user_id}/build/${ctx.build_id}/output/output.pdf?clsiserverid=${ctx.clsiServerId}`
        )
      })
    })

    describe('anon', function () {
      beforeEach(async function (ctx) {
        ctx.SessionManager.getLoggedInUserId.returns(null)
        await ctx.CompileController.downloadPdf(ctx.req, ctx.res, ctx.next)
      })

      it('should proxy the PDF from the CLSI', function (ctx) {
        ctx.fetchUtils.fetchStreamWithResponse.should.have.been.calledWith(
          `${ctx.settings.apis.clsi.downloadHost}/project/${ctx.projectId}/build/${ctx.build_id}/output/output.pdf?clsiserverid=${ctx.clsiServerId}`
        )
      })
    })

    describe('when rate-limited', function () {
      beforeEach(async function (ctx) {
        ctx.rateLimiter.consume.rejects({
          msBeforeNext: 250,
          remainingPoints: 0,
          consumedPoints: 5,
          isFirstInDuration: false,
        })
      })
      it('should return 500', async function (ctx) {
        await ctx.CompileController.downloadPdf(ctx.req, ctx.res, ctx.next)
        expect(ctx.res.status).toBeCalledWith(429)
        ctx.fetchUtils.fetchStreamWithResponse.should.not.have.been.called
      })
    })

    describe('when rate-limit errors', function () {
      beforeEach(async function (ctx) {
        ctx.rateLimiter.consume.rejects(new Error('uh oh'))
      })
      it('should return 500', async function (ctx) {
        await ctx.CompileController.downloadPdf(ctx.req, ctx.res, ctx.next)
        expect(ctx.res.status).toBeCalledWith(500)
        ctx.fetchUtils.fetchStreamWithResponse.should.not.have.been.called
      })
    })
  })

  describe('getOutputZipFromClsi', function () {
    beforeEach(function (ctx) {
      ctx.clsiServerId = 'clsi-server-1'
      ctx.req.params = {
        Project_id: ctx.projectId,
        build_id: ctx.build_id,
      }
      ctx.req.query = { clsiserverid: ctx.clsiServerId }
      ctx.req.session = {}
      ctx.project = { name: 'test namè; 1' }
      ctx.ProjectGetter.promises.getProject = sinon.stub().resolves(ctx.project)
    })

    describe('free user', function () {
      beforeEach(async function (ctx) {
        await ctx.CompileController.getOutputZipFromClsi(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should look up the project', function (ctx) {
        ctx.ProjectGetter.promises.getProject
          .calledWith(ctx.projectId, { name: 1 })
          .should.equal(true)
      })

      it('should set the content-type of the response to application/zip', function (ctx) {
        expect(ctx.res.contentType).toBeCalledWith('application/zip')
      })

      it('should set the content-disposition header with a safe version of the project name', function (ctx) {
        expect(ctx.res.headers['Content-Disposition']).toEqual(
          'attachment; filename="test_namè__1-output.zip"'
        )
      })

      it('should proxy the PDF from the CLSI', function (ctx) {
        ctx.fetchUtils.fetchStreamWithResponse.should.have.been.calledWith(
          `${ctx.settings.apis.clsi.url}/project/${ctx.projectId}/user/${ctx.user_id}/build/${ctx.build_id}/output/output.zip?compileBackendClass=free&clsiserverid=${ctx.clsiServerId}`
        )
      })
    })

    describe('premium user', function () {
      beforeEach(async function (ctx) {
        ctx.CompileManager.promises.getProjectCompileLimits = sinon
          .stub()
          .resolves({
            compileGroup: 'priority',
            compileBackendClass: 'premium',
          })
        await ctx.CompileController.getOutputZipFromClsi(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should proxy the PDF from the CLSI', function (ctx) {
        ctx.fetchUtils.fetchStreamWithResponse.should.have.been.calledWith(
          `${ctx.settings.apis.clsi.url}/project/${ctx.projectId}/user/${ctx.user_id}/build/${ctx.build_id}/output/output.zip?compileBackendClass=premium&clsiserverid=${ctx.clsiServerId}`
        )
      })
    })
  })

  describe('getFileForSubmissionFromClsi', function () {
    beforeEach(function (ctx) {
      ctx.submission_id = 'sub-1234'
      ctx.clsiServerId = 'clsi-server-1'
      ctx.file = 'output.pdf'
      ctx.req.params = {
        submissionId: ctx.submission_id,
        build_id: ctx.build_id,
        file: ctx.file,
      }
      ctx.req.query = { clsiserverid: ctx.clsiServerId }
    })

    describe('proxy to CLSI with correct URL', function () {
      beforeEach(async function (ctx) {
        await ctx.CompileController.getFileForSubmissionFromClsi(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should proxy to CLSI with correct URL', function (ctx) {
        const expectedUrl = `${ctx.settings.apis.clsi.downloadHost}/project/${ctx.submission_id}/build/${ctx.build_id}/output/${ctx.file}?clsiserverid=${ctx.clsiServerId}`
        ctx.fetchUtils.fetchStreamWithResponse.should.have.been.calledWith(
          expectedUrl
        )
      })
    })
  })

  describe('proxySyncCode', function () {
    let file, line, column, imageName, editorId, buildId, clsiServerId

    beforeEach(async function (ctx) {
      ctx.req.params = { Project_id: ctx.projectId }
      clsiServerId = 'clsi-1'
      file = 'main.tex'
      line = String(Date.now())
      column = String(Date.now() + 1)
      editorId = '172977cb-361e-4854-a4dc-a71cf11512e5'
      buildId = '195b4a3f9e7-03e5be430a9e7796'
      ctx.req.query = {
        file,
        line,
        column,
        editorId,
        buildId,
        clsiserverid: clsiServerId,
      }

      imageName = 'foo/bar:tag-0'
      ctx.ProjectGetter.promises.getProject = sinon
        .stub()
        .resolves({ imageName })

      ctx.CompileController._proxyToClsi = sinon.stub().resolves()

      await ctx.CompileController.proxySyncCode(ctx.req, ctx.res, ctx.next)
    })

    it('should parse the parameters', function (ctx) {
      expect(ctx.CompileManager.promises.syncTeX).to.have.been.calledWith(
        ctx.projectId,
        ctx.user_id,
        {
          direction: 'code',
          compileFromClsiCache: true,
          validatedOptions: {
            file,
            line,
            column,
            editorId,
            buildId,
          },
          clsiServerId,
        }
      )
    })
  })

  describe('proxySyncPdf', function () {
    let page, h, v, imageName, editorId, buildId, clsiServerId

    beforeEach(async function (ctx) {
      ctx.req.params = { Project_id: ctx.projectId }
      clsiServerId = 'clsi-1'
      page = String(Date.now())
      h = String(Math.random())
      v = String(Math.random())
      editorId = '172977cb-361e-4854-a4dc-a71cf11512e5'
      buildId = '195b4a3f9e7-03e5be430a9e7796'
      ctx.req.query = {
        page,
        h,
        v,
        editorId,
        buildId,
        clsiserverid: clsiServerId,
      }

      imageName = 'foo/bar:tag-1'
      ctx.ProjectGetter.promises.getProject = sinon
        .stub()
        .resolves({ imageName })

      ctx.CompileController._proxyToClsi = sinon.stub()

      await ctx.CompileController.proxySyncPdf(ctx.req, ctx.res, ctx.next)
    })

    it('should parse the parameters', function (ctx) {
      expect(ctx.CompileManager.promises.syncTeX).to.have.been.calledWith(
        ctx.projectId,
        ctx.user_id,
        {
          direction: 'pdf',
          compileFromClsiCache: true,
          validatedOptions: {
            page,
            h,
            v,
            editorId,
            buildId,
          },
          clsiServerId,
        }
      )
    })
  })

  describe('getFileFromClsi', function () {
    beforeEach(function (ctx) {
      ctx.clsiServerId = 'clsi-server-1'
      ctx.req.params = {
        Project_id: ctx.projectId,
        build_id: ctx.build_id,
        file: 'output.blg',
      }
      ctx.req.query = { clsiserverid: ctx.clsiServerId }
      ctx.req.session = {}
      ctx.req.method = 'GET'
    })

    describe('when the output.blg exists', function () {
      beforeEach(async function (ctx) {
        await ctx.CompileController.getFileFromClsi(ctx.req, ctx.res, ctx.next)
      })

      it('should open a request to the CLSI download host with compile limits', function (ctx) {
        ctx.fetchUtils.fetchStreamWithResponse.should.have.been.calledWith(
          `${ctx.settings.apis.clsi.downloadHost}/project/${ctx.projectId}/user/${ctx.user_id}/build/${ctx.build_id}/output/output.blg?clsiserverid=${ctx.clsiServerId}`
        )
      })

      it('should pass the response stream on to the client', function (ctx) {
        ctx.pipeline.should.have.been.calledWith(ctx.clsiStream, ctx.res)
      })
    })

    describe('when the output.blg traverses up', function () {
      beforeEach(async function (ctx) {
        ctx.req.params.file = '../output.blg'
        ctx.next = sinon.stub()
        await ctx.CompileController.getFileFromClsi(ctx.req, ctx.res, ctx.next)
      })

      it('should reject the request', function (ctx) {
        ctx.next.should.have.been.calledWithMatch({
          name: 'InvalidParamsError',
          zodError: asZodError({
            code: 'custom',
            path: ['params', 'file'],
            message: 'path traversal detected',
          }),
        })
      })

      it('should not open a request to CLSI', function (ctx) {
        ctx.fetchUtils.fetchStreamWithResponse.should.not.have.been.called
      })
    })

    describe('when the buildId traverses up', function () {
      beforeEach(async function (ctx) {
        ctx.req.params.build_id = '../..'
        ctx.next = sinon.stub()
        await ctx.CompileController.getFileFromClsi(ctx.req, ctx.res, ctx.next)
      })

      it('should reject the request', function (ctx) {
        ctx.next.should.have.been.calledWithMatch({
          name: 'InvalidParamsError',
          zodError: asZodError({
            origin: 'string',
            code: 'invalid_format',
            format: 'regex',
            pattern: '/^[0-9a-f]+-[0-9a-f]+$/',
            path: ['params', 'build_id'],
            message: 'invalid buildId',
          }),
        })
      })

      it('should not open a request to CLSI', function (ctx) {
        ctx.fetchUtils.fetchStreamWithResponse.should.not.have.been.called
      })
    })

    describe('when the output.blg does not exist', function () {
      beforeEach(async function (ctx) {
        ctx.editorId = '0e546f78-928e-4e8a-b5ea-3136ccf1dc53'
        ctx.req.query = {
          clsiserverid: ctx.clsiServerId,
          editorId: ctx.editorId,
        }
        ctx.clsiURL = `${ctx.settings.apis.clsi.downloadHost}/project/${ctx.projectId}/user/${ctx.user_id}/build/${ctx.build_id}/output/output.blg?clsiserverid=${ctx.clsiServerId}`
        ctx.fetchUtils.fetchStreamWithResponse.rejects(
          new RequestFailedError(
            ctx.clsiURL,
            { method: 'GET' },
            { status: 404 }
          )
        )
        await ctx.CompileController.getFileFromClsi(ctx.req, ctx.res, ctx.next)
      })

      it('should open a request to the CLSI', function (ctx) {
        ctx.fetchUtils.fetchStreamWithResponse.should.have.been.calledWith(
          ctx.clsiURL
        )
      })

      it('should fallback to clsi-cache', function (ctx) {
        ctx.ClsiCacheController._downloadFromCacheWithParams.should.have.been.calledWith(
          ctx.req,
          ctx.res,
          ctx.projectId,
          `${ctx.editorId}-${ctx.build_id}`,
          'output.blg'
        )
      })
    })

    describe('when the output.stderr does not exist', function () {
      beforeEach(async function (ctx) {
        ctx.req.params.file = 'output.stderr'
        ctx.editorId = '0e546f78-928e-4e8a-b5ea-3136ccf1dc53'
        ctx.req.query = {
          clsiserverid: ctx.clsiServerId,
          editorId: ctx.editorId,
        }
        ctx.clsiURL = `${ctx.settings.apis.clsi.downloadHost}/project/${ctx.projectId}/user/${ctx.user_id}/build/${ctx.build_id}/output/output.stderr?clsiserverid=${ctx.clsiServerId}`
        ctx.fetchUtils.fetchStreamWithResponse.rejects(
          new RequestFailedError(
            ctx.clsiURL,
            { method: 'GET' },
            { status: 404 }
          )
        )
        await ctx.CompileController.getFileFromClsi(ctx.req, ctx.res, ctx.next)
      })

      it('should open a request to the CLSI', function (ctx) {
        ctx.fetchUtils.fetchStreamWithResponse.should.have.been.calledWith(
          ctx.clsiURL
        )
      })

      it('should not fallback to clsi-cache', function (ctx) {
        ctx.ClsiCacheController._downloadFromCacheWithParams.should.not.have
          .been.called
        expect(ctx.res.statusCode).to.equal(404)
      })
    })
  })

  describe('deleteAuxFiles', function () {
    beforeEach(async function (ctx) {
      ctx.CompileManager.promises.deleteAuxFiles = sinon.stub().resolves()
      ctx.req.params = { Project_id: ctx.projectId }
      ctx.req.query = { clsiserverid: 'node-1' }
      ctx.res.sendStatus = sinon.stub()
      await ctx.CompileController.deleteAuxFiles(ctx.req, ctx.res, ctx.next)
    })

    it('should proxy to the CLSI', function (ctx) {
      ctx.CompileManager.promises.deleteAuxFiles
        .calledWith(ctx.projectId, ctx.user_id, 'node-1')
        .should.equal(true)
    })

    it('should return a 200', function (ctx) {
      ctx.res.sendStatus.calledWith(200).should.equal(true)
    })
  })

  describe('compileAndDownloadPdf', function () {
    const clsiServerId = 'server-1'

    beforeEach(function (ctx) {
      ctx.req = {
        params: {
          project_id: ctx.projectId,
        },
        method: 'GET',
      }
      ctx.CompileManager.promises.compile.resolves({
        status: 'success',
        outputFiles: [{ path: 'output.pdf' }],
        clsiServerId,
        buildId: ctx.build_id,
      })
      ctx.res = {
        send: () => {},
        sendStatus: sinon.stub(),
        writeHead: sinon.stub(),
        setHeader: sinon.stub(),
        setTimeout: sinon.stub(),
        headersSent: false,
      }
    })

    it('should call compile in the compile manager', async function (ctx) {
      await ctx.CompileController.compileAndDownloadPdf(ctx.req, ctx.res)
      ctx.CompileManager.promises.compile
        .calledWith(ctx.projectId)
        .should.equal(true)
    })

    it('should proxy the PDF from the CLSI with the correct URL', async function (ctx) {
      await ctx.CompileController.compileAndDownloadPdf(ctx.req, ctx.res)
      ctx.fetchUtils.fetchStreamWithResponse.should.have.been.calledWith(
        `${ctx.settings.apis.clsi.downloadHost}/project/${ctx.projectId}/build/${ctx.build_id}/output/output.pdf?clsiserverid=${clsiServerId}`
      )
    })

    it('should not download anything on compilation failures', async function (ctx) {
      ctx.CompileManager.promises.compile.rejects(new Error('failed'))
      await ctx.CompileController.compileAndDownloadPdf(
        ctx.req,
        ctx.res,
        ctx.next
      )
      ctx.res.sendStatus.should.have.been.calledWith(500)
      ctx.fetchUtils.fetchStreamWithResponse.should.not.have.been.called
    })

    it('should not download anything on missing pdf', async function (ctx) {
      ctx.CompileManager.promises.compile.resolves({
        status: 'success',
        outputFiles: [],
        clsiServerId,
        buildId: ctx.build_id,
      })
      await ctx.CompileController.compileAndDownloadPdf(ctx.req, ctx.res)
      ctx.res.sendStatus.should.have.been.calledWith(500)
      ctx.fetchUtils.fetchStreamWithResponse.should.not.have.been.called
    })
  })

  describe('wordCount', function () {
    beforeEach(async function (ctx) {
      ctx.CompileManager.promises.wordCount = sinon
        .stub()
        .resolves({ content: 'body' })
      ctx.req.params = { Project_id: ctx.projectId }
      ctx.req.query = { clsiserverid: 'node-42' }
      ctx.res.json = sinon.stub()
      ctx.res.contentType = sinon.stub()
      await ctx.CompileController.wordCount(ctx.req, ctx.res, ctx.next)
    })

    it('should proxy to the CLSI', function (ctx) {
      ctx.CompileManager.promises.wordCount
        .calledWith(ctx.projectId, ctx.user_id, false, 'node-42')
        .should.equal(true)
    })

    it('should return a 200 and body', function (ctx) {
      ctx.res.json.calledWith({ content: 'body' }).should.equal(true)
    })
  })
})
