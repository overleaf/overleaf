import { vi, expect } from 'vitest'
import { setTimeout } from 'node:timers/promises'
import sinon from 'sinon'
import tk from 'timekeeper'
import { RequestFailedError } from '@overleaf/fetch-utils'

const FILESTORE_URL = 'http://filestore.example.com'
const CLSI_HOST = 'clsi.example.com'
const MODULE_PATH = '../../../../app/src/Features/Compile/ClsiManager.mjs'

const GLOBAL_BLOB_HASH = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

describe('ClsiManager', function () {
  beforeEach(async function (ctx) {
    tk.freeze(Date.now())

    ctx.user_id = 'user-id'
    ctx.project = {
      _id: 'project-id',
      compiler: 'latex',
      rootDoc_id: 'mock-doc-id-1',
      imageName: 'mock-image-name',
      overleaf: { history: { id: 42 } },
    }
    ctx.docs = {
      '/main.tex': {
        name: 'main.tex',
        _id: 'mock-doc-id-1',
        lines: ['Hello', 'world'],
      },
      '/chapters/chapter1.tex': {
        name: 'chapter1.tex',
        _id: 'mock-doc-id-2',
        lines: ['Chapter 1'],
      },
    }
    ctx.files = {
      '/images/frog.png': {
        name: 'frog.png',
        _id: 'mock-file-id-1',
        created: new Date(),
        hash: GLOBAL_BLOB_HASH,
      },
      '/images/image.png': {
        name: 'image.png',
        _id: 'mock-file-id-2',
        created: new Date(),
        hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
      '/images/no-hash.png': {
        name: 'no-hash.png',
        _id: 'mock-file-id-3',
        created: new Date(),
      },
    }
    ctx.clsiCookieKey = 'clsiserver'
    ctx.clsiServerId = 'clsi-server-id'
    ctx.newClsiServerId = 'newserver'
    ctx.rawOutputFiles = {}
    ctx.responseBody = {
      compile: {
        status: 'success',
        stats: {
          isInitialCompile: 1,
          restoredClsiCache: 1,
        },
        timings: { compileE2E: 1337 },
        outputFiles: [
          {
            path: 'output.pdf',
            size: 42,
            url: 'http://localhost:3013/snip/output.pdf',
          },
        ],
      },
    }
    ctx.response = {
      ok: true,
      status: 200,
      headers: {
        raw: sinon.stub().returns({
          'set-cookie': [`${ctx.clsiCookieKey}=${ctx.newClsiServerId}`],
        }),
      },
    }

    ctx.FetchUtils = {
      fetchString: sinon
        .stub()
        .callsFake(() => Promise.resolve(JSON.stringify(ctx.responseBody))),
      fetchStringWithResponse: sinon.stub().callsFake(() =>
        Promise.resolve({
          body: JSON.stringify(ctx.responseBody),
          response: ctx.response,
        })
      ),
      fetchStream: sinon.stub(),
      RequestFailedError,
    }
    ctx.ClsiCookieManager = {
      promises: {
        clearServerId: sinon.stub().resolves(),
        getServerId: sinon.stub().resolves('clsi-server-id'),
        setServerId: sinon.stub().resolves(),
      },
    }
    ctx.ClsiStateManager = {
      computeHash: sinon.stub().returns('01234567890abcdef'),
    }
    ctx.ClsiFormatChecker = {
      checkRecoursesForProblems: sinon.stub().returns(),
    }
    ctx.Project = {}
    ctx.ProjectEntityHandler = {
      getAllDocPathsFromProject: sinon.stub(),
      promises: {
        getAllDocs: sinon.stub().resolves(ctx.docs),
        getAllFiles: sinon.stub().resolves(ctx.files),
      },
    }
    ctx.ProjectGetter = {
      promises: {
        findById: sinon.stub().resolves(ctx.project),
        getProject: sinon.stub().resolves(ctx.project),
      },
    }
    ctx.DocumentUpdaterHandler = {
      promises: {
        clearProjectState: sinon.stub().resolves(),
        flushProjectToMongo: sinon.stub().resolves(),
        getProjectDocsIfMatch: sinon.stub().resolves(),
      },
    }
    ctx.Metrics = {
      Timer: class Metrics {
        constructor() {
          this.done = sinon.stub()
        }
      },
      inc: sinon.stub(),
      count: sinon.stub(),
      histogram: sinon.stub(),
    }
    ctx.Settings = {
      apis: {
        filestore: {
          url: FILESTORE_URL,
          secret: 'secret',
        },
        clsi: {
          url: `http://${CLSI_HOST}`,
          submissionBackendClass: 'c3d',
        },
        clsi_new: {
          sample: 100,
        },
      },
      enablePdfCaching: true,
      clsiCookie: { key: 'clsiserver' },
    }
    ctx.ClsiCacheHandler = {
      clearCache: sinon.stub().resolves(),
    }
    ctx.HistoryManager = {
      getFilestoreBlobURL: sinon.stub().callsFake((historyId, hash) => {
        if (hash === GLOBAL_BLOB_HASH) {
          return `${FILESTORE_URL}/history/global/hash/${hash}`
        }
        return `${FILESTORE_URL}/history/project/${historyId}/hash/${hash}`
      }),
    }
    ctx.SplitTestHandler = {
      getPercentile: sinon.stub().returns(42),
    }
    ctx.AnalyticsManager = {
      recordEventForUserInBackground: sinon.stub(),
    }

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.Settings,
    }))

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler',
      () => ({
        default: ctx.SplitTestHandler,
      })
    )

    vi.doMock('../../../../app/src/models/Project', () => ({
      Project: ctx.Project,
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEntityHandler',
      () => ({
        default: ctx.ProjectEntityHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler',
      () => ({
        default: ctx.DocumentUpdaterHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/Compile/ClsiCookieManager', () => ({
      default: () => ctx.ClsiCookieManager,
    }))

    vi.doMock('../../../../app/src/Features/Compile/ClsiStateManager', () => ({
      default: ctx.ClsiStateManager,
    }))

    vi.doMock('../../../../app/src/Features/Compile/ClsiCacheHandler', () => ({
      default: ctx.ClsiCacheHandler,
    }))

    vi.doMock('@overleaf/fetch-utils', () => ctx.FetchUtils)

    vi.doMock('../../../../app/src/Features/Compile/ClsiFormatChecker', () => ({
      default: ctx.ClsiFormatChecker,
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: ctx.Metrics,
    }))

    vi.doMock('../../../../app/src/Features/History/HistoryManager', () => ({
      default: ctx.HistoryManager,
    }))

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({
        default: ctx.AnalyticsManager,
      })
    )

    ctx.ClsiManager = (await import(MODULE_PATH)).default
  })

  afterAll(function () {
    tk.reset()
  })

  describe('sendRequest', function () {
    describe('with a successful compile', function () {
      const buildId = '18fbe9e7564-30dcb2f71250c690'

      beforeEach(async function (ctx) {
        ctx.outputFiles = [
          {
            url: `/project/${ctx.project_id}/user/${ctx.user_id}/build/1234/output/output.pdf`,
            path: 'output.pdf',
            type: 'pdf',
            build: buildId,
          },
          {
            url: `/project/${ctx.project_id}/user/${ctx.user_id}/build/1234/output/output.log`,
            path: 'output.log',
            type: 'log',
            build: buildId,
          },
        ]
        ctx.responseBody.compile.outputFiles = ctx.outputFiles.map(
          outputFile => ({
            ...outputFile,
            url: `http://${CLSI_HOST}${outputFile.url}`,
          })
        )
        ctx.responseBody.compile.buildId = buildId
        ctx.timeout = 100
        ctx.result = await ctx.ClsiManager.promises.sendRequest(
          ctx.project._id,
          ctx.user_id,
          {
            compileBackendClass: 'c3d',
            compileGroup: 'standard',
            timeout: ctx.timeout,
          }
        )
      })

      it('should send the request to the CLSI', function (ctx) {
        ctx.FetchUtils.fetchStringWithResponse.should.have.been.calledWith(
          sinon.match(
            url =>
              url.host === CLSI_HOST &&
              url.pathname ===
                `/project/${ctx.project._id}/user/${ctx.user_id}/compile` &&
              url.searchParams.get('compileBackendClass') === 'c3d' &&
              url.searchParams.get('compileGroup') === 'standard'
          ),
          {
            method: 'POST',
            json: sinon.match({
              compile: {
                options: {
                  compiler: ctx.project.compiler,
                  imageName: ctx.project.imageName,
                  timeout: ctx.timeout,
                  draft: false,
                  compileGroup: 'standard',
                  metricsMethod: 'standard',
                  stopOnFirstError: false,
                  syncType: undefined,
                },
                rootResourcePath: 'main.tex',
                resources: _makeResources(ctx.project, ctx.docs, ctx.files),
              },
            }),
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Cookie: `${ctx.clsiCookieKey}=${ctx.clsiServerId}`,
            },
            signal: sinon.match.instanceOf(AbortSignal),
          }
        )
      })

      it('should get the project with the required fields', function (ctx) {
        ctx.ProjectGetter.promises.getProject.should.have.been.calledWith(
          ctx.project._id,
          {
            compiler: 1,
            rootDoc_id: 1,
            imageName: 1,
            rootFolder: 1,
            'overleaf.history.id': 1,
          }
        )
      })

      it('should flush the project to the database', function (ctx) {
        ctx.DocumentUpdaterHandler.promises.flushProjectToMongo.should.have.been.calledWith(
          ctx.project._id
        )
      })

      it('should get all the docs', function (ctx) {
        ctx.ProjectEntityHandler.promises.getAllDocs.should.have.been.calledWith(
          ctx.project._id
        )
      })

      it('should get all the files', function (ctx) {
        ctx.ProjectEntityHandler.promises.getAllFiles.should.have.been.calledWith(
          ctx.project._id
        )
      })

      it('should return the status and output files', function (ctx) {
        expect(ctx.result.status).to.equal('success')
        expect(ctx.result.outputFiles.map(f => f.path)).to.have.members(
          ctx.outputFiles.map(f => f.path)
        )
      })

      it('should return the buildId', function (ctx) {
        expect(ctx.result.buildId).to.equal(buildId)
      })

      it('should persist the cookie from the response', function (ctx) {
        expect(
          ctx.ClsiCookieManager.promises.setServerId
        ).to.have.been.calledWith(
          ctx.project._id,
          ctx.user_id,
          'standard',
          'c3d',
          ctx.newClsiServerId
        )
      })
    })

    describe('with ranges on the pdf and stats/timings details', function () {
      beforeEach(async function (ctx) {
        ctx.ranges = [{ start: 1, end: 42, hash: 'foo' }]
        ctx.startXRefTable = 123
        ctx.size = 456
        ctx.contentId = '123-321'
        ctx.outputFiles = [
          {
            url: `/project/${ctx.project._id}/user/${ctx.user_id}/build/1234/output/output.pdf`,
            path: 'output.pdf',
            type: 'pdf',
            build: 1234,
            contentId: ctx.contentId,
            ranges: ctx.ranges,
            startXRefTable: ctx.startXRefTable,
            size: ctx.size,
          },
          {
            url: `/project/${ctx.project._id}/user/${ctx.user_id}/build/1234/output/output.log`,
            path: 'output.log',
            type: 'log',
            build: 1234,
          },
        ]
        ctx.stats = { fooStat: 1 }
        ctx.timings = { barTiming: 2 }
        ctx.responseBody.compile.outputFiles = ctx.outputFiles.map(
          outputFile => ({
            ...outputFile,
            url: `http://${CLSI_HOST}${outputFile.url}`,
          })
        )
        ctx.responseBody.compile.stats = ctx.stats
        ctx.responseBody.compile.timings = ctx.timings
        ctx.result = await ctx.ClsiManager.promises.sendRequest(
          ctx.project._id,
          ctx.user_id,
          { compileBackendClass: 'c3d', compileGroup: 'standard' }
        )
      })

      it('should emit the caching details and stats/timings', function (ctx) {
        expect(ctx.result.status).to.equal('success')
        expect(ctx.result.clsiServerId).to.equal(ctx.newClsiServerId)
        expect(ctx.result.validationError).to.be.undefined
        expect(ctx.result.stats).to.deep.equal(ctx.stats)
        expect(ctx.result.timings).to.deep.equal(ctx.timings)
        const outputPdf = ctx.result.outputFiles.find(
          f => f.path === 'output.pdf'
        )
        expect(outputPdf.ranges).to.deep.equal(ctx.ranges)
        expect(outputPdf.startXRefTable).to.equal(ctx.startXRefTable)
        expect(outputPdf.contentId).to.equal(ctx.contentId)
        expect(outputPdf.size).to.equal(ctx.size)
      })
    })

    describe('with the incremental compile option', function () {
      beforeEach(async function (ctx) {
        const doc = ctx.docs['/main.tex']
        ctx.DocumentUpdaterHandler.promises.getProjectDocsIfMatch.resolves([
          { _id: doc._id, lines: doc.lines, v: 123 },
        ])
        ctx.ProjectEntityHandler.getAllDocPathsFromProject.returns({
          'mock-doc-id-1': 'main.tex',
        })
        ctx.result = await ctx.ClsiManager.promises.sendRequest(
          ctx.project._id,
          ctx.user_id,
          {
            timeout: 100,
            incrementalCompilesEnabled: true,
            compileBackendClass: 'c3d',
            compileGroup: 'priority',
            compileFromClsiCache: true,
            populateClsiCache: true,
            enablePdfCaching: true,
            pdfCachingMinChunkSize: 1337,
          }
        )
      })

      it('should get the project with the required fields', function (ctx) {
        ctx.ProjectGetter.promises.getProject.should.have.been.calledWith(
          ctx.project._id,
          {
            compiler: 1,
            rootDoc_id: 1,
            imageName: 1,
            rootFolder: 1,
            'overleaf.history.id': 1,
          }
        )
      })

      it('should not explicitly flush the project to the database', function (ctx) {
        ctx.DocumentUpdaterHandler.promises.flushProjectToMongo.should.not.have.been.calledWith(
          ctx.project._id
        )
      })

      it('should get only the live docs from the docupdater with a background flush in docupdater', function (ctx) {
        ctx.DocumentUpdaterHandler.promises.getProjectDocsIfMatch.should.have.been.calledWith(
          ctx.project._id
        )
      })

      it('should not get any of the files', function (ctx) {
        ctx.ProjectEntityHandler.promises.getAllFiles.should.not.have.been
          .called
      })

      it('should build up the CLSI request', function (ctx) {
        ctx.FetchUtils.fetchStringWithResponse.should.have.been.calledWith(
          sinon.match(
            url =>
              url.hostname === CLSI_HOST &&
              url.pathname ===
                `/project/${ctx.project._id}/user/${ctx.user_id}/compile` &&
              url.searchParams.get('compileBackendClass') === 'c3d' &&
              url.searchParams.get('compileGroup') === 'priority'
          ),
          {
            method: 'POST',
            json: sinon.match({
              compile: {
                options: {
                  compiler: ctx.project.compiler,
                  timeout: 100,
                  imageName: ctx.project.imageName,
                  draft: false,
                  syncType: 'incremental',
                  syncState: '01234567890abcdef',
                  compileGroup: 'priority',
                  compileFromClsiCache: true,
                  populateClsiCache: true,
                  enablePdfCaching: true,
                  pdfCachingMinChunkSize: 1337,
                  metricsMethod: 'priority',
                  stopOnFirstError: false,
                },
                rootResourcePath: 'main.tex',
                resources: [
                  {
                    path: 'main.tex',
                    content: ctx.docs['/main.tex'].lines.join('\n'),
                  },
                ],
              },
            }),
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Cookie: `${ctx.clsiCookieKey}=${ctx.clsiServerId}`,
            },
            signal: sinon.match.instanceOf(AbortSignal),
          }
        )
      })
    })

    describe('when the root doc is set and not in the docupdater', function () {
      beforeEach(async function (ctx) {
        const doc = ctx.docs['/main.tex']
        ctx.DocumentUpdaterHandler.promises.getProjectDocsIfMatch.resolves([
          { _id: doc._id, lines: doc.lines, v: 123 },
        ])
        ctx.ProjectEntityHandler.getAllDocPathsFromProject.returns({
          'mock-doc-id-1': 'main.tex',
          'mock-doc-id-2': '/chapters/chapter1.tex',
        })
        await ctx.ClsiManager.promises.sendRequest(
          ctx.project._id,
          ctx.user_id,
          {
            timeout: 100,
            incrementalCompilesEnabled: true,
            rootDoc_id: 'mock-doc-id-2',
          }
        )
      })

      it('should still change the root path', function (ctx) {
        ctx.FetchUtils.fetchStringWithResponse.should.have.been.calledWith(
          sinon.match.any,
          sinon.match({
            json: { compile: { rootResourcePath: 'chapters/chapter1.tex' } },
          })
        )
      })
    })

    describe('when root doc override is valid', function () {
      beforeEach(async function (ctx) {
        await ctx.ClsiManager.promises.sendRequest(
          ctx.project._id,
          ctx.user_id,
          { rootDoc_id: 'mock-doc-id-2' }
        )
      })

      it('should change root path', function (ctx) {
        ctx.FetchUtils.fetchStringWithResponse.should.have.been.calledWith(
          sinon.match.any,
          sinon.match({
            json: { compile: { rootResourcePath: 'chapters/chapter1.tex' } },
          })
        )
      })
    })

    describe('when root doc override is invalid', function () {
      beforeEach(async function (ctx) {
        await ctx.ClsiManager.promises.sendRequest(
          ctx.project._id,
          ctx.user_id,
          { rootDoc_id: 'invalid-id' }
        )
      })

      it('should fallback to default root doc', function (ctx) {
        ctx.FetchUtils.fetchStringWithResponse.should.have.been.calledWith(
          sinon.match.any,
          sinon.match({
            json: { compile: { rootResourcePath: 'main.tex' } },
          })
        )
      })
    })

    describe('when the project has an invalid compiler', function () {
      beforeEach(async function (ctx) {
        ctx.project.compiler = 'context'
        await ctx.ClsiManager.promises.sendRequest(
          ctx.project._id,
          ctx.user_id,
          {}
        )
      })

      it('should set the compiler to pdflatex', function (ctx) {
        expect(ctx.FetchUtils.fetchStringWithResponse).to.have.been.calledWith(
          sinon.match.any,
          sinon.match({
            json: { compile: { options: { compiler: 'pdflatex' } } },
          })
        )
      })
    })

    describe('when there is no valid root document', function () {
      beforeEach(async function (ctx) {
        ctx.project.rootDoc_id = 'not-valid'
        await ctx.ClsiManager.promises.sendRequest(
          ctx.project._id,
          ctx.user_id,
          {}
        )
      })

      it('should set to main.tex', function (ctx) {
        expect(ctx.FetchUtils.fetchStringWithResponse).to.have.been.calledWith(
          sinon.match.any,
          sinon.match({
            json: { compile: { rootResourcePath: 'main.tex' } },
          })
        )
      })
    })

    describe('when there is no valid root document and no main.tex document', function () {
      beforeEach(async function (ctx) {
        ctx.project.rootDoc_id = 'not-valid'
        ctx.docs = {
          '/other.tex': {
            name: 'other.tex',
            _id: 'mock-doc-id-1',
            lines: ['Hello', 'world'],
          },
          '/chapters/chapter1.tex': {
            name: 'chapter1.tex',
            _id: 'mock-doc-id-2',
            lines: ['Chapter 1'],
          },
        }
        ctx.ProjectEntityHandler.promises.getAllDocs.resolves(ctx.docs)
        ctx.result = await ctx.ClsiManager.promises.sendRequest(
          ctx.project._id,
          ctx.user_id,
          {}
        )
      })

      it('should report a validation problem', function (ctx) {
        expect(ctx.result.status).to.equal('validation-problems')
      })
    })

    describe('when there is no valid root document and a single document which is not main.tex', function () {
      beforeEach(async function (ctx) {
        ctx.project.rootDoc_id = 'not-valid'
        ctx.docs = {
          '/other.tex': {
            name: 'other.tex',
            _id: 'mock-doc-id-1',
            lines: ['Hello', 'world'],
          },
        }
        ctx.ProjectEntityHandler.promises.getAllDocs.resolves(ctx.docs)
        await ctx.ClsiManager.promises.sendRequest(
          ctx.project._id,
          ctx.user_id,
          {}
        )
      })

      it('should set io to the only file', function (ctx) {
        expect(ctx.FetchUtils.fetchStringWithResponse).to.have.been.calledWith(
          sinon.match.any,
          sinon.match({
            json: { compile: { rootResourcePath: 'other.tex' } },
          })
        )
      })
    })

    describe('with the draft option', function () {
      beforeEach(async function (ctx) {
        await ctx.ClsiManager.promises.sendRequest(
          ctx.project._id,
          ctx.user_id,
          {
            timeout: 100,
            draft: true,
          }
        )
      })

      it('should add the draft option into the request', function (ctx) {
        expect(ctx.FetchUtils.fetchStringWithResponse).to.have.been.calledWith(
          sinon.match.any,
          sinon.match({
            json: { compile: { options: { draft: true } } },
          })
        )
      })
    })

    describe('with a failed compile', function () {
      beforeEach(async function (ctx) {
        ctx.responseBody.compile.status = 'failure'
        ctx.result = await ctx.ClsiManager.promises.sendRequest(
          ctx.project._id,
          ctx.user_id,
          {}
        )
      })

      it('should return a failure status', function (ctx) {
        expect(ctx.result.status).to.equal('failure')
      })
    })

    describe('with a sync conflict', function () {
      beforeEach(async function (ctx) {
        const conflictResponseBody = { compile: { status: 'conflict' } }
        ctx.FetchUtils.fetchStringWithResponse
          .withArgs(
            sinon.match.any,
            sinon.match({
              json: sinon.match(
                json => json.compile.options.syncType !== 'full'
              ),
            })
          )
          .resolves({
            body: JSON.stringify(conflictResponseBody),
            response: ctx.response,
          })
        ctx.result = await ctx.ClsiManager.promises.sendRequest(
          ctx.project._id,
          ctx.user_id,
          {}
        )
      })

      it('should send two requests to CLSI', function (ctx) {
        ctx.FetchUtils.fetchStringWithResponse.should.have.been.calledTwice
      })

      it('should call the CLSI first without syncType:full', function (ctx) {
        const compileOptions =
          ctx.FetchUtils.fetchStringWithResponse.getCall(0).args[1].json.compile
            .options
        expect(compileOptions.syncType).to.be.undefined
      })

      it('should call the CLSI a second time with syncType:full', function (ctx) {
        const compileOptions =
          ctx.FetchUtils.fetchStringWithResponse.getCall(1).args[1].json.compile
            .options
        expect(compileOptions.syncType).to.equal('full')
      })

      it('should return a success status', function (ctx) {
        ctx.result.status.should.equal('success')
      })
    })

    describe('with an unavailable response', function () {
      beforeEach(async function (ctx) {
        ctx.FetchUtils.fetchStringWithResponse.onCall(0).resolves({
          body: JSON.stringify({ compile: { status: 'unavailable' } }),
          response: ctx.response,
        })
        ctx.result = await ctx.ClsiManager.promises.sendRequest(
          ctx.project._id,
          ctx.user_id,
          { compileBackendClass: 'c3d' }
        )
      })

      it('should send two requests to CLSI', function (ctx) {
        ctx.FetchUtils.fetchStringWithResponse.should.have.been.calledTwice
      })

      it('should call the CLSI first without syncType:full', function (ctx) {
        const compileOptions =
          ctx.FetchUtils.fetchStringWithResponse.getCall(0).args[1].json.compile
            .options
        expect(compileOptions.syncType).to.be.undefined
      })

      it('should call the CLSI a second time with syncType:full', function (ctx) {
        const compileOptions =
          ctx.FetchUtils.fetchStringWithResponse.getCall(1).args[1].json.compile
            .options
        expect(compileOptions.syncType).to.equal('full')
      })

      it('should clear the CLSI server id cookie', function (ctx) {
        expect(
          ctx.ClsiCookieManager.promises.clearServerId
        ).to.have.been.calledWith(ctx.project._id, ctx.user_id, 'c3d')
      })

      it('should return a success status', function (ctx) {
        expect(ctx.result.status).to.equal('success')
      })
    })

    describe('when the resources fail the precompile check', function () {
      beforeEach(function (ctx) {
        ctx.ClsiFormatChecker.checkRecoursesForProblems.throws(
          new Error('failed')
        )
      })

      it('should throw an error', async function (ctx) {
        await expect(
          ctx.ClsiManager.promises.sendRequest(ctx.project._id, ctx.user_id, {})
        ).to.be.rejected
      })
    })

    describe('when a new backend is configured', function () {
      beforeEach(async function (ctx) {
        ctx.Settings.apis.clsi_new = { url: 'https://compiles.somewhere.test' }
        await ctx.ClsiManager.promises.sendRequest(
          ctx.project._id,
          ctx.user_id,
          {
            compileBackendClass: 'c4d',
            compileGroup: 'priority',
          }
        )
        // wait for the background task to finish
        await setTimeout(0)
      })

      it('makes a request to the new backend', function (ctx) {
        expect(ctx.FetchUtils.fetchStringWithResponse).to.have.been.calledTwice
        expect(ctx.FetchUtils.fetchStringWithResponse).to.have.been.calledWith(
          sinon.match(
            url =>
              url.host === CLSI_HOST &&
              url.pathname ===
                `/project/${ctx.project._id}/user/${ctx.user_id}/compile` &&
              url.searchParams.get('compileBackendClass') === 'c4d' &&
              url.searchParams.get('compileGroup') === 'priority'
          )
        )
        expect(ctx.FetchUtils.fetchStringWithResponse).to.have.been.calledWith(
          sinon.match(
            url =>
              url.toString() ===
              `${ctx.Settings.apis.clsi_new.url}/project/${ctx.project._id}/user/${ctx.user_id}/compile?compileBackendClass=n4&compileGroup=priority`
          )
        )
      })
      it('should record an event', function (ctx) {
        expect(
          ctx.AnalyticsManager.recordEventForUserInBackground
        ).to.have.been.calledWith(ctx.user_id, 'double-compile-result', {
          projectId: 'project-id',
          compileBackendClass: 'c4d',
          newCompileBackendClass: 'n4',
          status: 'success',
          compileTime: 1337,
          newCompileTime: 1337,
          clsiServerId: 'newserver',
          newClsiServerId: 'clsi-server-id',
          pdfSize: 42,
          newPdfSize: 42,
        })
      })
    })
  })

  describe('sendExternalRequest', function () {
    beforeEach(function (ctx) {
      ctx.submissionId = 'submission-id'
      ctx.clsiRequest = 'mock-request'
    })

    describe('with a successful compile', function () {
      beforeEach(async function (ctx) {
        ctx.outputFiles = [
          {
            url: `/project/${ctx.submissionId}/build/1234/output/output.pdf`,
            path: 'output.pdf',
            type: 'pdf',
            build: 1234,
          },
          {
            url: `/project/${ctx.submissionId}/build/1234/output/output.log`,
            path: 'output.log',
            type: 'log',
            build: 1234,
          },
        ]
        ctx.responseBody.compile.outputFiles = ctx.outputFiles.map(
          outputFile => ({
            ...outputFile,
            url: `http://${CLSI_HOST}${outputFile.url}`,
          })
        )
        ctx.result = await ctx.ClsiManager.promises.sendExternalRequest(
          ctx.submissionId,
          ctx.clsiRequest,
          { compileBackendClass: 'c3d', compileGroup: 'standard' }
        )
      })

      it('should send the request to the CLSI', function (ctx) {
        ctx.FetchUtils.fetchStringWithResponse.should.have.been.calledWith(
          sinon.match(
            url =>
              url.host === CLSI_HOST &&
              url.pathname === `/project/${ctx.submissionId}/compile` &&
              url.searchParams.get('compileBackendClass') === 'c3d' &&
              url.searchParams.get('compileGroup') === 'standard'
          ),
          {
            method: 'POST',
            json: ctx.clsiRequest,
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Cookie: `${ctx.clsiCookieKey}=${ctx.clsiServerId}`,
            },
            signal: sinon.match.instanceOf(AbortSignal),
          }
        )
      })

      it('should return the status and output files', function (ctx) {
        expect(ctx.result.status).to.equal('success')
        expect(ctx.result.outputFiles.map(f => f.path)).to.have.members(
          ctx.outputFiles.map(f => f.path)
        )
      })
    })

    describe('with a failed compile', function () {
      beforeEach(async function (ctx) {
        ctx.responseBody.compile.status = 'failure'
        ctx.result = await ctx.ClsiManager.promises.sendExternalRequest(
          ctx.submissionId,
          ctx.clsiRequest,
          {}
        )
      })

      it('should return a failure status', function (ctx) {
        expect(ctx.result.status).to.equal('failure')
      })
    })

    describe('when the resources fail the precompile check', function () {
      beforeEach(async function (ctx) {
        ctx.ClsiFormatChecker.checkRecoursesForProblems.throws(
          new Error('failed')
        )
        ctx.responseBody.compile.status = 'failure'
      })

      it('should throw an error', async function (ctx) {
        await expect(
          ctx.ClsiManager.promises.sendExternalRequest(
            ctx.submissionId,
            ctx.clsiRequest,
            {}
          )
        ).to.be.rejected
      })
    })
  })

  describe('deleteAuxFiles', function () {
    describe('with the standard compileGroup', function () {
      beforeEach(async function (ctx) {
        await ctx.ClsiManager.promises.deleteAuxFiles(
          ctx.project._id,
          ctx.user_id,
          { compileBackendClass: 'c3d', compileGroup: 'standard' },
          'node-1'
        )
      })

      it('should call the delete method in the standard CLSI', function (ctx) {
        ctx.FetchUtils.fetchString.should.have.been.calledWith(
          sinon.match(
            url =>
              url.host === CLSI_HOST &&
              url.pathname ===
                `/project/${ctx.project._id}/user/${ctx.user_id}` &&
              url.searchParams.get('compileBackendClass') === 'c3d' &&
              url.searchParams.get('compileGroup') === 'standard' &&
              url.searchParams.get('clsiserverid') === 'node-1'
          ),
          { method: 'DELETE' }
        )
      })

      it('should clear the output.tar.gz files in clsi-cache', function (ctx) {
        ctx.ClsiCacheHandler.clearCache
          .calledWith(ctx.project._id, ctx.user_id)
          .should.equal(true)
      })

      it('should clear the project state from the docupdater', function (ctx) {
        ctx.DocumentUpdaterHandler.promises.clearProjectState
          .calledWith(ctx.project._id)
          .should.equal(true)
      })

      it('should clear the clsi persistance', function (ctx) {
        ctx.ClsiCookieManager.promises.clearServerId
          .calledWith(ctx.project._id, ctx.user_id, 'c3d')
          .should.equal(true)
      })

      it('should not persist a cookie on response', function (ctx) {
        expect(ctx.ClsiCookieManager.promises.setServerId).not.to.have.been
          .called
      })
    })

    describe('when a new backend is configured', function () {
      beforeEach(async function (ctx) {
        ctx.Settings.apis.clsi_new = { url: 'https://compiles.somewhere.test' }
        await ctx.ClsiManager.promises.deleteAuxFiles(
          ctx.project._id,
          ctx.user_id,
          { compileBackendClass: 'c4d', compileGroup: 'priority' },
          'node-1'
        )
        // wait for the background task to finish
        await setTimeout(0)
      })

      it('should clear both cookies', function (ctx) {
        expect(
          ctx.ClsiCookieManager.promises.clearServerId
        ).to.have.been.calledWith(ctx.project._id, ctx.user_id, 'c4d')
        expect(
          ctx.ClsiCookieManager.promises.clearServerId
        ).to.have.been.calledWith(ctx.project._id, ctx.user_id, 'n4')
      })

      it('should forward delete request', function (ctx) {
        expect(ctx.FetchUtils.fetchString).to.have.been.calledWith(
          sinon.match(
            url =>
              url.host === CLSI_HOST &&
              url.pathname ===
                `/project/${ctx.project._id}/user/${ctx.user_id}` &&
              url.searchParams.get('compileBackendClass') === 'c4d' &&
              url.searchParams.get('compileGroup') === 'priority' &&
              url.searchParams.get('clsiserverid') === 'node-1'
          ),
          { method: 'DELETE' }
        )
        expect(ctx.FetchUtils.fetchStringWithResponse).to.have.been.calledWith(
          sinon.match(
            url =>
              url.host === 'compiles.somewhere.test' &&
              url.pathname ===
                `/project/${ctx.project._id}/user/${ctx.user_id}` &&
              url.searchParams.get('compileBackendClass') === 'n4' &&
              url.searchParams.get('compileGroup') === 'priority' &&
              !url.searchParams.has('clsiserverid')
          ),
          sinon.match({ method: 'DELETE' })
        )
      })
    })
  })

  describe('wordCount', function () {
    describe('with root file', function () {
      beforeEach(async function (ctx) {
        await ctx.ClsiManager.promises.wordCount(
          ctx.project._id,
          ctx.user_id,
          false,
          { compileBackendClass: 'c3d', compileGroup: 'standard' },
          'node-1'
        )
      })

      it('should call wordCount with root file', function (ctx) {
        expect(ctx.FetchUtils.fetchString).to.have.been.calledWith(
          sinon.match(
            url =>
              url.toString() ===
              `http://clsi.example.com/project/${ctx.project._id}/user/${ctx.user_id}/wordcount?compileBackendClass=c3d&compileGroup=standard&file=main.tex&image=mock-image-name&clsiserverid=node-1`
          )
        )
      })

      it('should not persist a cookie on response', function (ctx) {
        expect(ctx.ClsiCookieManager.promises.setServerId).not.to.have.been
          .called
      })
    })

    describe('with param file', function () {
      beforeEach(async function (ctx) {
        await ctx.ClsiManager.promises.wordCount(
          ctx.project._id,
          ctx.user_id,
          'other.tex',
          { compileBackendClass: 'c3d', compileGroup: 'standard' },
          'node-2'
        )
      })

      it('should call wordCount with param file', function (ctx) {
        expect(ctx.FetchUtils.fetchString).to.have.been.calledWith(
          sinon.match(
            url =>
              url.host === CLSI_HOST &&
              url.pathname ===
                `/project/${ctx.project._id}/user/${ctx.user_id}/wordcount` &&
              url.searchParams.get('compileBackendClass') === 'c3d' &&
              url.searchParams.get('compileGroup') === 'standard' &&
              url.searchParams.get('clsiserverid') === 'node-2' &&
              url.searchParams.get('file') === 'other.tex' &&
              url.searchParams.get('image') === 'mock-image-name'
          )
        )
      })

      it('should not persist a cookie on response', function (ctx) {
        expect(ctx.ClsiCookieManager.promises.setServerId).not.to.have.been
          .called
      })
    })

    describe('when a new backend is configured', function () {
      beforeEach(async function (ctx) {
        ctx.Settings.apis.clsi_new = { url: 'https://compiles.somewhere.test' }
        await ctx.ClsiManager.promises.wordCount(
          ctx.project._id,
          ctx.user_id,
          false,
          { compileBackendClass: 'c4d', compileGroup: 'priority' },
          'node-1'
        )
        // wait for the background task to finish
        await setTimeout(0)
      })

      it('should forward wordcount request', function (ctx) {
        expect(ctx.FetchUtils.fetchString).to.have.been.calledWith(
          sinon.match(
            url =>
              url.toString() ===
              `http://clsi.example.com/project/${ctx.project._id}/user/${ctx.user_id}/wordcount?compileBackendClass=c4d&compileGroup=priority&file=main.tex&image=mock-image-name&clsiserverid=node-1`
          )
        )
        expect(ctx.FetchUtils.fetchStringWithResponse).to.have.been.calledWith(
          sinon.match(
            url =>
              url.toString() ===
              `${ctx.Settings.apis.clsi_new.url}/project/${ctx.project._id}/user/${ctx.user_id}/wordcount?compileBackendClass=n4&compileGroup=priority&file=main.tex&image=mock-image-name`
          )
        )
      })
    })
  })
})

function _makeResources(project, docs, files) {
  const resources = []
  for (const [path, doc] of Object.entries(docs)) {
    resources.push({
      path: path.replace(/^\//, ''),
      content: doc.lines.join('\n'),
    })
  }
  for (const [path, file] of Object.entries(files)) {
    let url
    if (file.hash === GLOBAL_BLOB_HASH) {
      url = `${FILESTORE_URL}/history/global/hash/${file.hash}`
    } else {
      url = `${FILESTORE_URL}/history/project/${project.overleaf.history.id}/hash/${file.hash}`
    }
    resources.push({
      path: path.replace(/^\//, ''),
      url,
      modified: file.created.getTime(),
    })
  }
  return resources
}
