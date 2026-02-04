import { vi, describe, beforeEach, it } from 'vitest'
import sinon from 'sinon'
import Errors from '../../../app/js/Errors.js'
import path from 'node:path'
const modulePath = path.join(
  import.meta.dirname,
  '../../../app/js/CompileController'
)

describe('CompileController', () => {
  beforeEach(async ctx => {
    ctx.buildId = 'build-id-123'

    vi.doMock('../../../app/js/CompileManager', () => ({
      default: (ctx.CompileManager = {}),
    }))

    vi.doMock('../../../app/js/RequestParser', () => ({
      default: (ctx.RequestParser = {}),
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.Settings = {
        apis: {
          clsi: {
            url: 'http://clsi.example.com',
            outputUrlPrefix: '/zone/b',
            downloadHost: 'http://localhost:3013',
          },
          clsiCache: {
            enabled: false,
            url: 'http://localhost:3044',
          },
        },
      }),
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: {
        Timer: sinon.stub().returns({ done: sinon.stub() }),
      },
    }))

    vi.doMock('../../../app/js/ProjectPersistenceManager', () => ({
      default: (ctx.ProjectPersistenceManager = {}),
    }))

    vi.doMock('../../../app/js/CLSICacheHandler', () => ({
      default: {
        notifyCLSICacheAboutBuild: sinon.stub(),
        downloadLatestCompileCache: sinon.stub().resolves(),
        downloadOutputDotSynctexFromCompileCache: sinon.stub().resolves(),
      },
    }))

    vi.doMock('../../../app/js/Errors', () => ({
      default: (ctx.Errors = Errors),
    }))

    ctx.CompileController = (await import(modulePath)).default
    ctx.Settings.externalUrl = 'http://www.example.com'
    ctx.req = {}
    ctx.res = {}
    ctx.next = sinon.stub()
  })

  describe('compile', () => {
    beforeEach(ctx => {
      ctx.req.body = {
        compile: 'mock-body',
      }
      ctx.req.params = { project_id: (ctx.project_id = 'project-id-123') }
      ctx.request = {
        compile: 'mock-parsed-request',
      }
      ctx.request_with_project_id = {
        compile: ctx.request.compile,
        project_id: ctx.project_id,
      }
      ctx.output_files = [
        {
          path: 'output.pdf',
          type: 'pdf',
          size: 1337,
          build: 1234,
        },
        {
          path: 'output.log',
          type: 'log',
          build: 1234,
        },
      ]
      ctx.RequestParser.parse = sinon.stub().callsArgWith(1, null, ctx.request)
      ctx.ProjectPersistenceManager.markProjectAsJustAccessed = sinon
        .stub()
        .callsArg(1)
      ctx.stats = { foo: 1 }
      ctx.timings = { bar: 2 }
      ctx.res.status = sinon.stub().returnsThis()
      ctx.res.send = sinon.stub()

      ctx.CompileManager.doCompileWithLock = sinon
        .stub()
        .callsFake((_req, stats, timings, cb) => {
          Object.assign(stats, ctx.stats)
          Object.assign(timings, ctx.timings)
          cb(null, {
            outputFiles: ctx.output_files,
            buildId: ctx.buildId,
          })
        })
    })

    describe('successfully', () => {
      beforeEach(ctx => {
        ctx.CompileController.compile(ctx.req, ctx.res)
      })

      it('should parse the request', ctx => {
        ctx.RequestParser.parse.calledWith(ctx.req.body).should.equal(true)
      })

      it('should run the compile for the specified project', ctx => {
        ctx.CompileManager.doCompileWithLock
          .calledWith(ctx.request_with_project_id)
          .should.equal(true)
      })

      it('should mark the project as accessed', ctx => {
        ctx.ProjectPersistenceManager.markProjectAsJustAccessed
          .calledWith(ctx.project_id)
          .should.equal(true)
      })

      it('should return the JSON response', ctx => {
        ctx.res.status.calledWith(200).should.equal(true)
        ctx.res.send
          .calledWith({
            compile: {
              status: 'success',
              error: null,
              stats: ctx.stats,
              timings: ctx.timings,
              buildId: ctx.buildId,
              outputUrlPrefix: '/zone/b',
              outputFiles: ctx.output_files.map(file => ({
                url: `${ctx.Settings.apis.clsi.url}/project/${ctx.project_id}/build/${file.build}/output/${file.path}`,
                ...file,
              })),
              clsiCacheShard: undefined,
            },
          })
          .should.equal(true)
      })
    })

    describe('without a outputUrlPrefix', () => {
      beforeEach(ctx => {
        ctx.Settings.apis.clsi.outputUrlPrefix = ''
        ctx.CompileController.compile(ctx.req, ctx.res)
      })

      it('should return the JSON response with empty outputUrlPrefix', ctx => {
        ctx.res.status.calledWith(200).should.equal(true)
        ctx.res.send
          .calledWith({
            compile: {
              status: 'success',
              error: null,
              stats: ctx.stats,
              timings: ctx.timings,
              buildId: ctx.buildId,
              outputUrlPrefix: '',
              outputFiles: ctx.output_files.map(file => ({
                url: `${ctx.Settings.apis.clsi.url}/project/${ctx.project_id}/build/${file.build}/output/${file.path}`,
                ...file,
              })),
              clsiCacheShard: undefined,
            },
          })
          .should.equal(true)
      })
    })

    describe('with user provided fake_output.pdf', () => {
      beforeEach(ctx => {
        ctx.output_files = [
          {
            path: 'fake_output.pdf',
            type: 'pdf',
            build: 1234,
          },
          {
            path: 'output.log',
            type: 'log',
            build: 1234,
          },
        ]
        ctx.CompileManager.doCompileWithLock = sinon
          .stub()
          .callsFake((_req, stats, timings, cb) => {
            Object.assign(stats, ctx.stats)
            Object.assign(timings, ctx.timings)
            cb(null, {
              outputFiles: ctx.output_files,
              buildId: ctx.buildId,
            })
          })
        ctx.CompileController.compile(ctx.req, ctx.res)
      })

      it('should return the JSON response with status failure', ctx => {
        ctx.res.status.calledWith(200).should.equal(true)
        ctx.res.send.should.have.been.calledWith({
          compile: {
            status: 'failure',
            error: null,
            stats: ctx.stats,
            timings: ctx.timings,
            outputUrlPrefix: '/zone/b',
            buildId: ctx.buildId,
            outputFiles: ctx.output_files.map(file => ({
              url: `${ctx.Settings.apis.clsi.url}/project/${ctx.project_id}/build/${file.build}/output/${file.path}`,
              ...file,
            })),
            clsiCacheShard: undefined,
          },
        })
      })
    })

    describe('with an empty output.pdf', () => {
      beforeEach(ctx => {
        ctx.output_files = [
          {
            path: 'output.pdf',
            type: 'pdf',
            size: 0,
            build: 1234,
          },
          {
            path: 'output.log',
            type: 'log',
            build: 1234,
          },
        ]
        ctx.CompileManager.doCompileWithLock = sinon
          .stub()
          .callsFake((_req, stats, timings, cb) => {
            Object.assign(stats, ctx.stats)
            Object.assign(timings, ctx.timings)
            cb(null, {
              outputFiles: ctx.output_files,
              buildId: ctx.buildId,
            })
          })
        ctx.CompileController.compile(ctx.req, ctx.res)
      })

      it('should return the JSON response with status failure', ctx => {
        ctx.res.status.calledWith(200).should.equal(true)
        ctx.res.send.should.have.been.calledWith({
          compile: {
            status: 'failure',
            error: null,
            stats: ctx.stats,
            buildId: ctx.buildId,
            timings: ctx.timings,
            outputUrlPrefix: '/zone/b',
            outputFiles: ctx.output_files.map(file => ({
              url: `${ctx.Settings.apis.clsi.url}/project/${ctx.project_id}/build/${file.build}/output/${file.path}`,
              ...file,
            })),
            clsiCacheShard: undefined,
          },
        })
      })
    })

    describe('with an error', () => {
      beforeEach(ctx => {
        const error = new Error((ctx.message = 'error message'))
        error.buildId = ctx.buildId
        ctx.CompileManager.doCompileWithLock = sinon
          .stub()
          .callsFake((_req, stats, timings, cb) => {
            Object.assign(stats, ctx.stats)
            Object.assign(timings, ctx.timings)
            cb(error)
          })
        ctx.CompileController.compile(ctx.req, ctx.res)
      })

      it('should return the JSON response with the error', ctx => {
        ctx.res.status.calledWith(500).should.equal(true)
        ctx.res.send
          .calledWith({
            compile: {
              status: 'error',
              error: ctx.message,
              outputUrlPrefix: '/zone/b',
              outputFiles: [],
              buildId: ctx.buildId,
              stats: ctx.stats,
              timings: ctx.timings,
              clsiCacheShard: undefined,
            },
          })
          .should.equal(true)
      })
    })

    describe('with too many compile requests error', () => {
      beforeEach(ctx => {
        const error = new Errors.TooManyCompileRequestsError(
          'too many concurrent compile requests'
        )
        ctx.CompileManager.doCompileWithLock = sinon
          .stub()
          .callsFake((_req, stats, timings, cb) => {
            Object.assign(stats, ctx.stats)
            Object.assign(timings, ctx.timings)
            cb(error)
          })
        ctx.CompileController.compile(ctx.req, ctx.res)
      })

      it('should return the JSON response with the error', ctx => {
        ctx.res.status.calledWith(503).should.equal(true)
        ctx.res.send
          .calledWith({
            compile: {
              status: 'unavailable',
              error: 'too many concurrent compile requests',
              outputUrlPrefix: '/zone/b',
              outputFiles: [],
              stats: ctx.stats,
              timings: ctx.timings,
              // JSON.stringify will omit these undefined values
              buildId: undefined,
              clsiCacheShard: undefined,
            },
          })
          .should.equal(true)
      })
    })

    describe('when the request times out', () => {
      beforeEach(ctx => {
        ctx.error = new Error((ctx.message = 'container timed out'))
        ctx.error.timedout = true
        ctx.CompileManager.doCompileWithLock = sinon
          .stub()
          .callsFake((_req, stats, timings, cb) => {
            Object.assign(stats, ctx.stats)
            Object.assign(timings, ctx.timings)
            cb(ctx.error)
          })
        ctx.CompileController.compile(ctx.req, ctx.res)
      })

      it('should return the JSON response with the timeout status', ctx => {
        ctx.res.status.calledWith(200).should.equal(true)
        ctx.res.send
          .calledWith({
            compile: {
              status: 'timedout',
              error: ctx.message,
              outputUrlPrefix: '/zone/b',
              outputFiles: [],
              stats: ctx.stats,
              timings: ctx.timings,
              // JSON.stringify will omit these undefined values
              buildId: undefined,
              clsiCacheShard: undefined,
            },
          })
          .should.equal(true)
      })
    })

    describe('when the request returns no output files', () => {
      beforeEach(ctx => {
        ctx.CompileManager.doCompileWithLock = sinon
          .stub()
          .callsFake((_req, stats, timings, cb) => {
            Object.assign(stats, ctx.stats)
            Object.assign(timings, ctx.timings)
            cb(null, {})
          })
        ctx.CompileController.compile(ctx.req, ctx.res)
      })

      it('should return the JSON response with the failure status', ctx => {
        ctx.res.status.calledWith(200).should.equal(true)
        ctx.res.send
          .calledWith({
            compile: {
              error: null,
              status: 'failure',
              outputUrlPrefix: '/zone/b',
              outputFiles: [],
              stats: ctx.stats,
              timings: ctx.timings,
              // JSON.stringify will omit these undefined values
              buildId: undefined,
              clsiCacheShard: undefined,
            },
          })
          .should.equal(true)
      })
    })
  })

  describe('syncFromCode', () => {
    beforeEach(ctx => {
      ctx.file = 'main.tex'
      ctx.line = 42
      ctx.column = 5
      ctx.project_id = 'mock-project-id'
      ctx.req.params = { project_id: ctx.project_id }
      ctx.req.query = {
        file: ctx.file,
        line: ctx.line.toString(),
        column: ctx.column.toString(),
      }
      ctx.res.json = sinon.stub()

      ctx.CompileManager.syncFromCode = sinon
        .stub()
        .yields(null, (ctx.pdfPositions = ['mock-positions']), true)
      ctx.CompileController.syncFromCode(ctx.req, ctx.res, ctx.next)
    })

    it('should find the corresponding location in the PDF', ctx => {
      ctx.CompileManager.syncFromCode
        .calledWith(ctx.project_id, undefined, ctx.file, ctx.line, ctx.column)
        .should.equal(true)
    })

    it('should return the positions', ctx => {
      ctx.res.json
        .calledWith({
          pdf: ctx.pdfPositions,
          downloadedFromCache: true,
        })
        .should.equal(true)
    })
  })

  describe('syncFromPdf', () => {
    beforeEach(ctx => {
      ctx.page = 5
      ctx.h = 100.23
      ctx.v = 45.67
      ctx.project_id = 'mock-project-id'
      ctx.req.params = { project_id: ctx.project_id }
      ctx.req.query = {
        page: ctx.page.toString(),
        h: ctx.h.toString(),
        v: ctx.v.toString(),
      }
      ctx.res.json = sinon.stub()

      ctx.CompileManager.syncFromPdf = sinon
        .stub()
        .yields(null, (ctx.codePositions = ['mock-positions']), true)
      ctx.CompileController.syncFromPdf(ctx.req, ctx.res, ctx.next)
    })

    it('should find the corresponding location in the code', ctx => {
      ctx.CompileManager.syncFromPdf
        .calledWith(ctx.project_id, undefined, ctx.page, ctx.h, ctx.v)
        .should.equal(true)
    })

    it('should return the positions', ctx => {
      ctx.res.json
        .calledWith({
          code: ctx.codePositions,
          downloadedFromCache: true,
        })
        .should.equal(true)
    })
  })

  describe('wordcount', () => {
    beforeEach(ctx => {
      ctx.file = 'main.tex'
      ctx.project_id = 'mock-project-id'
      ctx.req.params = { project_id: ctx.project_id }
      ctx.req.query = {
        file: ctx.file,
        image: (ctx.image = 'example.com/image'),
      }
      ctx.res.json = sinon.stub()

      ctx.CompileManager.wordcount = sinon
        .stub()
        .callsArgWith(4, null, (ctx.texcount = ['mock-texcount']))
    })

    it('should return the word count of a file', ctx => {
      ctx.CompileController.wordcount(ctx.req, ctx.res, ctx.next)
      ctx.CompileManager.wordcount
        .calledWith(ctx.project_id, undefined, ctx.file, ctx.image)
        .should.equal(true)
    })

    it('should return the texcount info', ctx => {
      ctx.CompileController.wordcount(ctx.req, ctx.res, ctx.next)
      ctx.res.json
        .calledWith({
          texcount: ctx.texcount,
        })
        .should.equal(true)
    })
  })
})
