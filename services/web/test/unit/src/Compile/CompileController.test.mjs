import { vi, expect } from 'vitest'
import sinon from 'sinon'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'
import { Headers } from 'node-fetch'
import { ReadableString } from '@overleaf/stream-utils'
import { RequestFailedError } from '@overleaf/fetch-utils'

const modulePath = '../../../../app/src/Features/Compile/CompileController.mjs'

describe('CompileController', function () {
  beforeEach(async function (ctx) {
    ctx.user_id = 'wat'
    ctx.user = {
      _id: ctx.user_id,
      email: 'user@example.com',
      features: {
        compileGroup: 'premium',
        compileTimeout: 100,
      },
    }
    ctx.CompileManager = {
      promises: {
        compile: sinon.stub(),
        getProjectCompileLimits: sinon.stub(),
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
          url: 'http://clsi.example.com',
          submissionBackendClass: 'c3d',
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

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('@overleaf/fetch-utils', () => ctx.fetchUtils)

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: (ctx.ProjectGetter = {
        promises: {},
      }),
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: (ctx.Metrics = {
        inc: sinon.stub(),
        Timer: class {
          constructor() {
            this.labels = {}
          }

          done() {}
        },
      }),
    }))

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
          getAssignment: (ctx.getAssignment = sinon.stub().yields(null, {
            variant: 'default',
          })),
          promises: {
            getAssignment: sinon.stub().resolves({
              variant: 'default',
            }),
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
    ctx.next = sinon.stub()
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
                url: `/project/${ctx.projectId}/user/wat/build/${ctx.build_id}/output/output.zip`,
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
                url: `/project/${ctx.projectId}/user/wat/build/${ctx.build_id}/output/output.zip`,
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
            enablePdfCaching: false,
            fileLineErrors: false,
            stopOnFirstError: false,
            editorId: undefined,
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
              url: `/project/${ctx.projectId}/user/wat/build/${ctx.build_id}/output/output.zip`,
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
            enablePdfCaching: false,
            fileLineErrors: false,
            stopOnFirstError: false,
            editorId: undefined,
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
            enablePdfCaching: false,
            draft: true,
            fileLineErrors: false,
            stopOnFirstError: false,
            editorId: undefined,
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
            enablePdfCaching: false,
            fileLineErrors: false,
            stopOnFirstError: false,
            editorId: 'the-editor-id',
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
          { compileGroup: 'special', compileBackendClass: 'c3d', timeout: 600 }
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
            compileBackendClass: 'c3d',
            timeout: 60,
          }
        )
      })
    })
  })

  describe('downloadPdf', function () {
    beforeEach(function (ctx) {
      ctx.CompileController._proxyToClsi = sinon.stub().resolves()
      ctx.req.params = { Project_id: ctx.projectId }
      ctx.project = { name: 'test namè; 1' }
      ctx.ProjectGetter.promises.getProject = sinon.stub().resolves(ctx.project)
    })

    describe('when downloading for embedding', function () {
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
        ctx.CompileController._proxyToClsi
          .calledWith(
            ctx.projectId,
            'output-file',
            `/project/${ctx.projectId}/user/${ctx.user_id}/output/output.pdf`,
            {},
            ctx.req,
            ctx.res
          )
          .should.equal(true)
      })
    })

    describe('when a build-id is provided', function () {
      beforeEach(async function (ctx) {
        ctx.req.params.build_id = ctx.build_id
        await ctx.CompileController.downloadPdf(ctx.req, ctx.res, ctx.next)
      })

      it('should proxy the PDF from the CLSI, with a build-id', function (ctx) {
        ctx.CompileController._proxyToClsi
          .calledWith(
            ctx.projectId,
            'output-file',
            `/project/${ctx.projectId}/user/${ctx.user_id}/build/${ctx.build_id}/output/output.pdf`,
            {},
            ctx.req,
            ctx.res
          )
          .should.equal(true)
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
        // should it be 429 instead?
        expect(ctx.res.sendStatus).toBeCalledWith(500)
        ctx.CompileController._proxyToClsi.should.not.have.been.called
      })
    })

    describe('when rate-limit errors', function () {
      beforeEach(async function (ctx) {
        ctx.rateLimiter.consume.rejects(new Error('uh oh'))
      })
      it('should return 500', async function (ctx) {
        await ctx.CompileController.downloadPdf(ctx.req, ctx.res, ctx.next)
        expect(ctx.res.sendStatus).toBeCalledWith(500)
        ctx.CompileController._proxyToClsi.should.not.have.been.called
      })
    })
  })

  describe('getFileFromClsiWithoutUser', function () {
    beforeEach(function (ctx) {
      ctx.submission_id = 'sub-1234'
      ctx.file = 'output.pdf'
      ctx.req.params = {
        submission_id: ctx.submission_id,
        build_id: ctx.build_id,
        file: ctx.file,
      }
      ctx.req.body = {}
      ctx.expected_url = `/project/${ctx.submission_id}/build/${ctx.build_id}/output/${ctx.file}`
      ctx.CompileController._proxyToClsiWithLimits = sinon.stub()
    })

    describe('without limits specified', function () {
      beforeEach(async function (ctx) {
        await ctx.CompileController.getFileFromClsiWithoutUser(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should proxy to CLSI with correct URL and default limits', function (ctx) {
        ctx.CompileController._proxyToClsiWithLimits.should.have.been.calledWith(
          ctx.submission_id,
          'output-file',
          ctx.expected_url,
          {},
          { compileGroup: 'standard', compileBackendClass: 'c3d' }
        )
      })
    })

    describe('with limits specified', function () {
      beforeEach(function (ctx) {
        ctx.req.body = { compileTimeout: 600, compileGroup: 'special' }
        ctx.CompileController.getFileFromClsiWithoutUser(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should proxy to CLSI with correct URL and specified limits', function (ctx) {
        ctx.CompileController._proxyToClsiWithLimits.should.have.been.calledWith(
          ctx.submission_id,
          'output-file',
          ctx.expected_url,
          {},
          {
            compileGroup: 'special',
            compileBackendClass: 'c3d',
          }
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

  describe('_proxyToClsi', function () {
    beforeEach(function (ctx) {
      ctx.req.method = 'mock-method'
      ctx.req.headers = {
        Mock: 'Headers',
        Range: '123-456',
        'If-Range': 'abcdef',
        'If-Modified-Since': 'Mon, 15 Dec 2014 15:23:56 GMT',
      }
    })

    describe('old pdf viewer', function () {
      describe('user with standard priority', function () {
        beforeEach(async function (ctx) {
          ctx.CompileManager.promises.getProjectCompileLimits = sinon
            .stub()
            .resolves({
              compileGroup: 'standard',
              compileBackendClass: 'c3d',
            })
          await ctx.CompileController._proxyToClsi(
            ctx.projectId,
            'output-file',
            (ctx.url = '/test'),
            { query: 'foo' },
            ctx.req,
            ctx.res,
            ctx.next
          )
        })

        it('should open a request to the CLSI', function (ctx) {
          ctx.fetchUtils.fetchStreamWithResponse.should.have.been.calledWith(
            `${ctx.settings.apis.clsi.url}${ctx.url}?compileGroup=standard&compileBackendClass=c3d&query=foo`
          )
        })

        it('should pass the request on to the client', function (ctx) {
          ctx.pipeline.should.have.been.calledWith(ctx.clsiStream, ctx.res)
        })
      })

      describe('user with priority compile', function () {
        beforeEach(async function (ctx) {
          ctx.CompileManager.promises.getProjectCompileLimits = sinon
            .stub()
            .resolves({
              compileGroup: 'priority',
              compileBackendClass: 'c4d',
            })
          await ctx.CompileController._proxyToClsi(
            ctx.projectId,
            'output-file',
            (ctx.url = '/test'),
            {},
            ctx.req,
            ctx.res,
            ctx.next
          )
        })

        it('should open a request to the CLSI', function (ctx) {
          ctx.fetchUtils.fetchStreamWithResponse.should.have.been.calledWith(
            `${ctx.settings.apis.clsi.url}${ctx.url}?compileGroup=priority&compileBackendClass=c4d`
          )
        })
      })

      describe('user with standard priority via query string', function () {
        beforeEach(async function (ctx) {
          ctx.req.query = { compileGroup: 'standard' }
          ctx.CompileManager.promises.getProjectCompileLimits = sinon
            .stub()
            .resolves({
              compileGroup: 'standard',
              compileBackendClass: 'c3d',
            })
          await ctx.CompileController._proxyToClsi(
            ctx.projectId,
            'output-file',
            (ctx.url = '/test'),
            {},
            ctx.req,
            ctx.res,
            ctx.next
          )
        })

        it('should open a request to the CLSI', function (ctx) {
          ctx.fetchUtils.fetchStreamWithResponse.should.have.been.calledWith(
            `${ctx.settings.apis.clsi.url}${ctx.url}?compileGroup=standard&compileBackendClass=c3d`
          )
        })

        it('should pass the request on to the client', function (ctx) {
          ctx.pipeline.should.have.been.calledWith(ctx.clsiStream, ctx.res)
        })
      })

      describe('user with non-existent priority via query string', function () {
        beforeEach(async function (ctx) {
          ctx.req.query = { compileGroup: 'foobar' }
          ctx.CompileManager.promises.getProjectCompileLimits = sinon
            .stub()
            .resolves({
              compileGroup: 'standard',
              compileBackendClass: 'c3d',
            })
          await ctx.CompileController._proxyToClsi(
            ctx.projectId,
            'output-file',
            (ctx.url = '/test'),
            {},
            ctx.req,
            ctx.res,
            ctx.next
          )
        })

        it('should proxy to the standard url', function (ctx) {
          ctx.fetchUtils.fetchStreamWithResponse.should.have.been.calledWith(
            `${ctx.settings.apis.clsi.url}${ctx.url}?compileGroup=standard&compileBackendClass=c3d`
          )
        })
      })

      describe('user with build parameter via query string', function () {
        beforeEach(async function (ctx) {
          ctx.CompileManager.promises.getProjectCompileLimits = sinon
            .stub()
            .resolves({
              compileGroup: 'standard',
              compileBackendClass: 'c3d',
            })
          ctx.req.query = { build: 1234 }
          await ctx.CompileController._proxyToClsi(
            ctx.projectId,
            'output-file',
            (ctx.url = '/test'),
            {},
            ctx.req,
            ctx.res,
            ctx.next
          )
        })

        it('should proxy to the standard url without the build parameter', function (ctx) {
          ctx.fetchUtils.fetchStreamWithResponse.should.have.been.calledWith(
            `${ctx.settings.apis.clsi.url}${ctx.url}?compileGroup=standard&compileBackendClass=c3d`
          )
        })
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
    beforeEach(function (ctx) {
      ctx.req = {
        params: {
          project_id: ctx.projectId,
        },
      }
      ctx.downloadPath = `/project/${ctx.projectId}/build/123/output/output.pdf`
      ctx.CompileManager.promises.compile.resolves({
        status: 'success',
        outputFiles: [{ path: 'output.pdf', url: ctx.downloadPath }],
      })
      ctx.CompileController._proxyToClsi = sinon.stub()
      ctx.res = {
        send: () => {},
        sendStatus: sinon.stub(),
      }
    })

    it('should call compile in the compile manager', async function (ctx) {
      await ctx.CompileController.compileAndDownloadPdf(ctx.req, ctx.res)
      ctx.CompileManager.promises.compile
        .calledWith(ctx.projectId)
        .should.equal(true)
    })

    it('should proxy the res to the clsi with correct url', async function (ctx) {
      await ctx.CompileController.compileAndDownloadPdf(ctx.req, ctx.res)
      sinon.assert.calledWith(
        ctx.CompileController._proxyToClsi,
        ctx.projectId,
        'output-file',
        ctx.downloadPath,
        {},
        ctx.req,
        ctx.res
      )

      ctx.CompileController._proxyToClsi
        .calledWith(
          ctx.projectId,
          'output-file',
          ctx.downloadPath,
          {},
          ctx.req,
          ctx.res
        )
        .should.equal(true)
    })

    it('should not download anything on compilation failures', async function (ctx) {
      ctx.CompileManager.promises.compile.rejects(new Error('failed'))
      await ctx.CompileController.compileAndDownloadPdf(
        ctx.req,
        ctx.res,
        ctx.next
      )
      ctx.res.sendStatus.should.have.been.calledWith(500)
      ctx.CompileController._proxyToClsi.should.not.have.been.called
    })

    it('should not download anything on missing pdf', async function (ctx) {
      ctx.CompileManager.promises.compile.resolves({
        status: 'success',
        outputFiles: [],
      })
      await ctx.CompileController.compileAndDownloadPdf(ctx.req, ctx.res)
      ctx.res.sendStatus.should.have.been.calledWith(500)
      ctx.CompileController._proxyToClsi.should.not.have.been.called
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
