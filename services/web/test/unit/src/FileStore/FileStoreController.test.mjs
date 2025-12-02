import { expect, vi } from 'vitest'
import sinon from 'sinon'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import MockResponse from '../helpers/MockResponse.mjs'

const MODULE_PATH =
  '../../../../app/src/Features/FileStore/FileStoreController.mjs'

const expectedFileHeaders = {
  'Cache-Control': 'private, max-age=3600',
}

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

describe('FileStoreController', function () {
  beforeEach(async function (ctx) {
    ctx.ProjectLocator = { promises: { findElement: sinon.stub() } }
    ctx.Stream = { pipeline: sinon.stub().resolves() }
    ctx.HistoryManager = {
      promises: { requestBlobWithProjectId: sinon.stub() },
    }

    vi.doMock('node:stream/promises', () => ctx.Stream)

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectLocator', () => ({
      default: ctx.ProjectLocator,
    }))

    vi.doMock('../../../../app/src/Features/History/HistoryManager', () => ({
      default: ctx.HistoryManager,
    }))

    ctx.controller = (await import(MODULE_PATH)).default
    ctx.stream = {}
    ctx.projectId = '2k3j1lk3j21lk3j'
    ctx.fileId = '12321kklj1lk3jk12'
    ctx.req = {
      params: {
        Project_id: ctx.projectId,
        File_id: ctx.fileId,
      },
      query: 'query string here',
      get(key) {
        return undefined
      },
      logger: {
        addFields: sinon.stub(),
      },
    }
    ctx.res = new MockResponse(vi)
    ctx.next = sinon.stub()
    ctx.hash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    ctx.file = { name: 'myfile.png', hash: ctx.hash }
  })

  describe('getFile', function () {
    beforeEach(function (ctx) {
      ctx.HistoryManager.promises.requestBlobWithProjectId.resolves({
        stream: ctx.stream,
      })
      ctx.ProjectLocator.promises.findElement.resolves({ element: ctx.file })
    })

    it('should call the history manager with the project_id hash', async function (ctx) {
      await ctx.controller.getFile(ctx.req, ctx.res)
      ctx.HistoryManager.promises.requestBlobWithProjectId.should.have.been.calledWith(
        ctx.req.params.Project_id,
        ctx.hash,
        'GET'
      )
    })

    it('should pipe to res', async function (ctx) {
      await ctx.controller.getFile(ctx.req, ctx.res)
      ctx.Stream.pipeline.should.have.been.calledWith(ctx.stream, ctx.res)
    })

    it('should get the file from the db', async function (ctx) {
      await ctx.controller.getFile(ctx.req, ctx.res)
      ctx.ProjectLocator.promises.findElement.should.have.been.calledWith({
        project_id: ctx.projectId,
        element_id: ctx.fileId,
        type: 'file',
      })
    })

    it('should set the Content-Disposition header', async function (ctx) {
      await ctx.controller.getFile(ctx.req, ctx.res)
      expect(ctx.res.setContentDisposition).toBeCalledWith('attachment', {
        filename: ctx.file.name,
      })
    })

    it('should return a 404 when not found', async function (ctx) {
      ctx.ProjectLocator.promises.findElement.rejects(
        new Errors.NotFoundError()
      )
      await ctx.controller.getFile(ctx.req, ctx.res)
      expect(ctx.res.statusCode).to.equal(404)
    })

    // Test behaviour around handling html files
    ;['.html', '.htm', '.xhtml'].forEach(extension => {
      describe(`with a '${extension}' file extension`, function () {
        beforeEach(function (ctx) {
          ctx.file.name = `bad${extension}`
          ctx.req.get = key => {
            if (key === 'User-Agent') {
              return 'A generic browser'
            }
          }
        })

        describe('from a non-ios browser', function () {
          it('should not set Content-Type', async function (ctx) {
            await ctx.controller.getFile(ctx.req, ctx.res)
            ctx.res.headers.should.deep.equal({
              ...expectedFileHeaders,
            })
          })
        })

        describe('from an iPhone', function () {
          beforeEach(function (ctx) {
            ctx.req.get = key => {
              if (key === 'User-Agent') {
                return 'An iPhone browser'
              }
            }
          })

          it("should set Content-Type to 'text/plain'", async function (ctx) {
            await ctx.controller.getFile(ctx.req, ctx.res)
            ctx.res.headers.should.deep.equal({
              ...expectedFileHeaders,
              'Content-Type': 'text/plain; charset=utf-8',
              'X-Content-Type-Options': 'nosniff',
            })
          })
        })

        describe('from an iPad', function () {
          beforeEach(function (ctx) {
            ctx.req.get = key => {
              if (key === 'User-Agent') {
                return 'An iPad browser'
              }
            }
          })

          it("should set Content-Type to 'text/plain'", async function (ctx) {
            await ctx.controller.getFile(ctx.req, ctx.res)
            ctx.res.headers.should.deep.equal({
              ...expectedFileHeaders,
              'Content-Type': 'text/plain; charset=utf-8',
              'X-Content-Type-Options': 'nosniff',
            })
          })
        })
      })
    })
    ;[
      // None of these should trigger the iOS/html logic
      'x.html-is-rad',
      'html.pdf',
      '.html-is-good-for-hidden-files',
      'somefile',
    ].forEach(filename => {
      describe(`with filename as '${filename}'`, function () {
        beforeEach(function (ctx) {
          ctx.user_agent = 'A generic browser'
          ctx.file.name = filename
          ctx.req.get = key => {
            if (key === 'User-Agent') {
              return ctx.user_agent
            }
          }
        })
        ;['iPhone', 'iPad', 'Firefox', 'Chrome'].forEach(browser => {
          describe(`downloaded from ${browser}`, function () {
            beforeEach(function (ctx) {
              ctx.user_agent = `Some ${browser} thing`
            })

            it('Should not set the Content-type', async function (ctx) {
              await ctx.controller.getFile(ctx.req, ctx.res)
              ctx.res.headers.should.deep.equal({
                ...expectedFileHeaders,
              })
            })
          })
        })
      })
    })
  })

  describe('getFileHead', function () {
    beforeEach(function (ctx) {
      ctx.ProjectLocator.promises.findElement.resolves({ element: ctx.file })
    })

    it('reports the file size', async function (ctx) {
      await new Promise(resolve => {
        const expectedFileSize = 99393
        ctx.HistoryManager.promises.requestBlobWithProjectId.rejects(
          new Error('getFileSize: unexpected arguments')
        )
        ctx.HistoryManager.promises.requestBlobWithProjectId
          .withArgs(ctx.projectId, ctx.hash)
          .resolves({ contentLength: expectedFileSize })

        ctx.res.end = () => {
          expect(ctx.res.status.mock.lastCall).to.deep.equal([200])
          expect(ctx.res.header.mock.lastCall).to.deep.equal([
            'Content-Length',
            expectedFileSize,
          ])
          resolve()
        }

        ctx.controller.getFileHead(ctx.req, ctx.res)
      })
    })

    it('returns 404 on NotFoundError', async function (ctx) {
      await new Promise(resolve => {
        ctx.HistoryManager.promises.requestBlobWithProjectId.rejects(
          new Errors.NotFoundError()
        )

        ctx.res.end = () => {
          expect(ctx.res.status.mock.lastCall).to.deep.equal([404])
          resolve()
        }

        ctx.controller.getFileHead(ctx.req, ctx.res)
      })
    })
  })
})
