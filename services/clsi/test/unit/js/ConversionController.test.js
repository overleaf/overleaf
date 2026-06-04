import sinon from 'sinon'
import { vi, describe, it, beforeEach, expect } from 'vitest'
import Path from 'node:path'
import { PassThrough } from 'node:stream'
import * as Errors from '../../../app/js/Errors.js'

const MODULE_PATH = Path.join(
  import.meta.dirname,
  '../../../app/js/ConversionController'
)

describe('ConversionController', function () {
  beforeEach(async function (ctx) {
    ctx.conversionDir = '/path/to/conversion/result'
    ctx.zipPath = '/path/to/conversion/result/output.zip'
    ctx.zipStat = { size: 1234 }
    ctx.documentPath = '/compiles/output-uuid/output-uuid.docx'
    ctx.documentStat = { size: 5678 }
    ctx.Settings = {
      enablePandocConversions: true,
      enablePdfConversions: true,
      path: {
        compilesDir: '/compiles',
        outputDir: '/output',
        clsiCacheDir: '/cache',
      },
    }
    ctx.OutputCacheManager = {
      CACHE_SUBDIR: 'generated-files',
      promises: {
        generateBuildId: sinon.stub().resolves('00000000001-0000000000000001'),
      },
    }
    ctx.ConversionOutputCleaner = {
      scheduleCleanup: sinon.stub(),
    }
    ctx.parsedRequest = { rootResourcePath: 'main.tex' }
    ctx.ConversionManager = {
      promises: {
        convertToLaTeXWithLock: sinon.stub().resolves(ctx.zipPath),
        convertLaTeXToDocumentInDirWithLock: sinon
          .stub()
          .resolves(ctx.documentPath),
      },
    }
    ctx.ResourceWriter = {
      promises: {
        syncResourcesToDisk: sinon.stub().resolves(),
      },
    }

    ctx.HistoryResourceWriter = {
      promises: {
        syncResourcesToDisk: sinon.stub().resolves(),
      },
    }

    ctx.RequestParser = {
      promises: {
        parse: sinon.stub().resolves(ctx.parsedRequest),
      },
    }

    ctx.fs = {
      stat: sinon.stub().resolves(ctx.zipStat),
      unlink: sinon.stub().resolves(),
      rm: sinon.stub().resolves(),
      mkdir: sinon.stub().resolves(),
      copyFile: sinon.stub().resolves(),
    }

    ctx.readStream = new PassThrough()
    ctx.fsSync = {
      createReadStream: sinon.stub().returns(ctx.readStream),
    }
    ctx.pipeline = sinon.stub().resolves()

    vi.doMock('node:fs/promises', () => ({
      default: ctx.fs,
    }))

    vi.doMock('node:fs', () => ({
      default: ctx.fsSync,
    }))

    vi.doMock('node:stream/promises', () => ({
      pipeline: ctx.pipeline,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.Settings,
    }))

    vi.doMock('../../../app/js/ConversionManager', () => ({
      default: ctx.ConversionManager,
    }))

    vi.doMock('../../../app/js/ResourceWriter', () => ({
      default: ctx.ResourceWriter,
    }))

    vi.doMock(
      '../../../app/js/HistoryResourceWriter',
      () => ctx.HistoryResourceWriter
    )

    vi.doMock('../../../app/js/RequestParser', () => ({
      default: ctx.RequestParser,
    }))

    vi.doMock('../../../app/js/OutputCacheManager', () => ({
      default: ctx.OutputCacheManager,
    }))

    vi.doMock('../../../app/js/ConversionOutputCleaner', () => ({
      default: ctx.ConversionOutputCleaner,
    }))

    vi.doMock('../../../app/js/Errors', () => Errors)

    ctx.res = new PassThrough()
    ctx.res.attachment = sinon.stub()
    ctx.res.setHeader = sinon.stub()
    ctx.res.json = sinon.stub()

    ctx.ConversionController = (await import(MODULE_PATH)).default
  })

  describe('convertDocumentToLaTeX', function () {
    describe('when conversions are disabled', function () {
      beforeEach(async function (ctx) {
        ctx.Settings.enablePandocConversions = false
        ctx.req = {
          file: { path: '/path/to/uploaded/file.docx' },
          query: { type: 'docx' },
        }
        ctx.res.sendStatus = sinon.stub()

        await ctx.ConversionController.convertDocumentToLaTeX(ctx.req, ctx.res)
      })

      it('should remove the uploaded file', function (ctx) {
        sinon.assert.calledWith(ctx.fs.unlink, ctx.req.file.path)
      })

      it('should return 404', function (ctx) {
        sinon.assert.calledWith(ctx.res.sendStatus, 404)
      })

      it('should not call the conversion manager', function (ctx) {
        sinon.assert.notCalled(
          ctx.ConversionManager.promises.convertToLaTeXWithLock
        )
      })
    })

    describe('when conversionType is missing', function () {
      beforeEach(async function (ctx) {
        ctx.req = {
          file: { path: '/path/to/uploaded/file.docx' },
          query: {},
        }
        ctx.res.sendStatus = sinon.stub()

        await ctx.ConversionController.convertDocumentToLaTeX(ctx.req, ctx.res)
      })

      it('should remove the uploaded file', function (ctx) {
        sinon.assert.calledWith(ctx.fs.unlink, ctx.req.file.path)
      })

      it('should return 400', function (ctx) {
        sinon.assert.calledWith(ctx.res.sendStatus, 400)
      })

      it('should not call the conversion manager', function (ctx) {
        sinon.assert.notCalled(
          ctx.ConversionManager.promises.convertToLaTeXWithLock
        )
      })
    })

    describe('when conversionType is unsupported', function () {
      beforeEach(async function (ctx) {
        ctx.req = {
          file: { path: '/path/to/uploaded/file.docx' },
          query: { type: 'invalid' },
        }
        ctx.res.sendStatus = sinon.stub()

        await ctx.ConversionController.convertDocumentToLaTeX(ctx.req, ctx.res)
      })

      it('should remove the uploaded file', function (ctx) {
        sinon.assert.calledWith(ctx.fs.unlink, ctx.req.file.path)
      })

      it('should return 400', function (ctx) {
        sinon.assert.calledWith(ctx.res.sendStatus, 400)
      })

      it('should not call the conversion manager', function (ctx) {
        sinon.assert.notCalled(
          ctx.ConversionManager.promises.convertToLaTeXWithLock
        )
      })
    })

    describe('successfully', function () {
      beforeEach(async function (ctx) {
        ctx.req = {
          file: { path: '/path/to/uploaded/file.docx' },
          query: { type: 'docx' },
        }

        await ctx.ConversionController.convertDocumentToLaTeX(ctx.req, ctx.res)
      })

      it('should call the conversion manager with the uploaded file path and type', function (ctx) {
        sinon.assert.calledWith(
          ctx.ConversionManager.promises.convertToLaTeXWithLock,
          sinon.match(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
          ),
          ctx.req.file.path,
          'docx'
        )
      })

      it('should look up the generated zip file size', function (ctx) {
        sinon.assert.calledWith(ctx.fs.stat, ctx.zipPath)
      })

      it('should set the response headers for a zip file download', function (ctx) {
        sinon.assert.calledWith(
          ctx.res.setHeader,
          'Content-Length',
          ctx.zipStat.size
        )
        sinon.assert.calledWith(ctx.res.attachment, 'conversion.zip')
        sinon.assert.calledWith(
          ctx.res.setHeader,
          'X-Content-Type-Options',
          'nosniff'
        )
      })

      it('should stream the generated zip file to the response', function (ctx) {
        sinon.assert.calledWith(ctx.fsSync.createReadStream, ctx.zipPath)
        sinon.assert.calledWith(ctx.pipeline, ctx.readStream, ctx.res)
      })

      it('should clean up the generated zip file', function (ctx) {
        sinon.assert.calledWith(ctx.fs.rm, ctx.conversionDir)
      })
    })

    describe('with conversionType=markdown', function () {
      beforeEach(async function (ctx) {
        ctx.req = {
          file: { path: '/path/to/uploaded/file.md' },
          query: { type: 'markdown' },
        }

        await ctx.ConversionController.convertDocumentToLaTeX(ctx.req, ctx.res)
      })

      it('should call the conversion manager with the uploaded file path and markdown type', function (ctx) {
        sinon.assert.calledWith(
          ctx.ConversionManager.promises.convertToLaTeXWithLock,
          sinon.match(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
          ),
          ctx.req.file.path,
          'markdown'
        )
      })
    })

    describe('unsuccessfully', function () {
      describe('on streaming error', function () {
        it('should propagate the error and still clean up', async function (ctx) {
          ctx.pipeline.rejects(new Error('mock stream error'))

          const res = new PassThrough()
          res.attachment = sinon.stub()
          res.setHeader = sinon.stub()

          const req = {
            file: { path: '/path/to/uploaded/file.docx' },
            query: { type: 'docx' },
          }

          await expect(
            ctx.ConversionController.convertDocumentToLaTeX(req, res)
          ).to.be.rejectedWith('mock stream error')

          sinon.assert.calledWith(ctx.fs.rm, ctx.conversionDir)
        })
      })

      describe('on a user-facing ConversionError', function () {
        beforeEach(async function (ctx) {
          ctx.jsonStub = sinon.stub()
          ctx.res.status = sinon.stub().returns({ json: ctx.jsonStub })
          ctx.req = {
            file: { path: '/path/to/uploaded/file.docx' },
            query: { type: 'docx' },
          }
          ctx.ConversionManager.promises.convertToLaTeXWithLock.rejects(
            new Errors.ConversionError('Non-zero exit code from pandoc', {
              type: 'docx',
              exitCode: 64,
              stderr: 'parse error at line 5',
            })
          )

          await ctx.ConversionController.convertDocumentToLaTeX(
            ctx.req,
            ctx.res
          )
        })

        it('should return 422 with the pandoc stderr in the response body', function (ctx) {
          sinon.assert.calledWith(ctx.res.status, 422)
          sinon.assert.calledWith(ctx.jsonStub, {
            error: 'parse error at line 5',
            exitCode: 64,
          })
        })

        it('should remove the uploaded file', function (ctx) {
          sinon.assert.calledWith(ctx.fs.unlink, ctx.req.file.path)
        })
      })

      describe('on a non-user-facing ConversionError', function () {
        beforeEach(async function (ctx) {
          ctx.jsonStub = sinon.stub()
          ctx.res.status = sinon.stub().returns({ json: ctx.jsonStub })
          ctx.req = {
            file: { path: '/path/to/uploaded/file.docx' },
            query: { type: 'docx' },
          }
          ctx.ConversionManager.promises.convertToLaTeXWithLock.rejects(
            new Errors.ConversionError('Non-zero exit code from pandoc', {
              type: 'docx',
              exitCode: 62,
              stderr: 'internal pandoc bug',
            })
          )

          await ctx.ConversionController.convertDocumentToLaTeX(
            ctx.req,
            ctx.res
          )
        })

        it('should return 422 without surfacing stderr', function (ctx) {
          sinon.assert.calledWith(ctx.res.status, 422)
          sinon.assert.calledWith(ctx.jsonStub, {})
        })

        it('should remove the uploaded file', function (ctx) {
          sinon.assert.calledWith(ctx.fs.unlink, ctx.req.file.path)
        })
      })
    })
  })

  describe('convertProjectToDocument', function () {
    beforeEach(function (ctx) {
      ctx.req = {
        body: {},
        params: { project_id: 'test-project-id', user_id: 'test-user-id' },
        query: { type: 'docx' },
      }
      ctx.fs.stat.resolves(ctx.documentStat)
    })

    describe('when conversions are disabled', function () {
      beforeEach(async function (ctx) {
        ctx.Settings.enablePandocConversions = false
        ctx.res.sendStatus = sinon.stub()

        await ctx.ConversionController.convertProjectToDocument(
          ctx.req,
          ctx.res,
          sinon.stub()
        )
      })

      it('should return 404', function (ctx) {
        sinon.assert.calledWith(ctx.res.sendStatus, 404)
      })

      it('should not sync resources or call the conversion manager', function (ctx) {
        sinon.assert.notCalled(ctx.ResourceWriter.promises.syncResourcesToDisk)
        sinon.assert.notCalled(
          ctx.ConversionManager.promises.convertLaTeXToDocumentInDirWithLock
        )
      })
    })

    describe('when an unsupported type is requested', function () {
      beforeEach(async function (ctx) {
        ctx.req.query = { type: 'unsupported' }
        ctx.res.sendStatus = sinon.stub()

        await ctx.ConversionController.convertProjectToDocument(
          ctx.req,
          ctx.res,
          sinon.stub()
        )
      })

      it('should return 400', function (ctx) {
        sinon.assert.calledWith(ctx.res.sendStatus, 400)
      })

      it('should not sync resources or call the conversion manager', function (ctx) {
        sinon.assert.notCalled(ctx.ResourceWriter.promises.syncResourcesToDisk)
        sinon.assert.notCalled(
          ctx.ConversionManager.promises.convertLaTeXToDocumentInDirWithLock
        )
      })
    })

    const uuidDirPattern =
      /^\/compiles\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

    describe('successfully (default streaming response)', function () {
      beforeEach(async function (ctx) {
        await ctx.ConversionController.convertProjectToDocument(
          ctx.req,
          ctx.res,
          sinon.stub()
        )
      })

      it('should sync resources to a unique conversion directory', function (ctx) {
        sinon.assert.calledWith(
          ctx.ResourceWriter.promises.syncResourcesToDisk,
          sinon.match({ rootResourcePath: 'main.tex' }),
          sinon.match(uuidDirPattern)
        )
      })

      it('should call convertLaTeXToDocumentInDirWithLock with docx type', function (ctx) {
        sinon.assert.calledWith(
          ctx.ConversionManager.promises.convertLaTeXToDocumentInDirWithLock,
          sinon.match(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
          ),
          sinon.match(uuidDirPattern),
          'main.tex',
          'docx'
        )
      })

      it('should set the Content-Length header from the document stat', function (ctx) {
        sinon.assert.calledWith(
          ctx.res.setHeader,
          'Content-Length',
          ctx.documentStat.size
        )
      })

      it('should set the attachment filename', function (ctx) {
        sinon.assert.calledWith(ctx.res.attachment, 'output.docx')
      })

      it('should set X-Content-Type-Options header', function (ctx) {
        sinon.assert.calledWith(
          ctx.res.setHeader,
          'X-Content-Type-Options',
          'nosniff'
        )
      })

      it('should stream the document to the response', function (ctx) {
        sinon.assert.calledWith(ctx.fsSync.createReadStream, ctx.documentPath)
        sinon.assert.calledWith(ctx.pipeline, ctx.readStream, ctx.res)
      })

      it('should not move the document or schedule cleanup', function (ctx) {
        sinon.assert.notCalled(ctx.fs.copyFile)
        sinon.assert.notCalled(ctx.ConversionOutputCleaner.scheduleCleanup)
      })

      it('should clean up the conversion directory', function (ctx) {
        sinon.assert.calledWith(ctx.fs.rm, sinon.match(uuidDirPattern), {
          recursive: true,
          force: true,
        })
      })
    })

    describe('successfully (responseFormat=json)', function () {
      beforeEach(async function (ctx) {
        ctx.req.query.responseFormat = 'json'
        await ctx.ConversionController.convertProjectToDocument(
          ctx.req,
          ctx.res,
          sinon.stub()
        )
      })

      it('should move the document into the conversion output build dir', function (ctx) {
        const outputBuildDirPattern =
          /^\/output\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/generated-files\/[0-9a-f]+-[0-9a-f]+$/
        sinon.assert.calledWith(
          ctx.fs.mkdir,
          sinon.match(outputBuildDirPattern),
          { recursive: true }
        )
        sinon.assert.calledWith(
          ctx.fs.copyFile,
          ctx.documentPath,
          sinon.match(filePath => {
            return (
              filePath.startsWith('/output/') &&
              filePath.endsWith('/output.docx')
            )
          })
        )
      })

      it('should schedule cleanup of the conversion output dir', function (ctx) {
        sinon.assert.calledWith(
          ctx.ConversionOutputCleaner.scheduleCleanup,
          sinon.match(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
          )
        )
      })

      it('should respond with the conversion id, build id, and file name', function (ctx) {
        sinon.assert.calledWith(
          ctx.res.json,
          sinon.match({
            conversionId: sinon.match(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
            ),
            buildId: sinon.match(/^[0-9a-f]+-[0-9a-f]+$/),
            file: 'output.docx',
          })
        )
      })

      it('should not stream the document', function (ctx) {
        sinon.assert.notCalled(ctx.fsSync.createReadStream)
        sinon.assert.notCalled(ctx.pipeline)
      })

      it('should clean up the working conversion directory', function (ctx) {
        sinon.assert.calledWith(ctx.fs.rm, sinon.match(uuidDirPattern), {
          recursive: true,
          force: true,
        })
      })
    })

    describe('with conversionType=markdown', function () {
      beforeEach(async function (ctx) {
        ctx.req.query = { type: 'markdown', projectName: 'My_Project' }
        ctx.fs.stat.resolves(ctx.documentStat)

        await ctx.ConversionController.convertProjectToDocument(
          ctx.req,
          ctx.res,
          sinon.stub()
        )
      })

      it('should call convertLaTeXToDocumentInDirWithLock with type=markdown', function (ctx) {
        sinon.assert.calledWith(
          ctx.ConversionManager.promises.convertLaTeXToDocumentInDirWithLock,
          sinon.match(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
          ),
          sinon.match(
            /^\/compiles\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
          ),
          'main.tex',
          'markdown'
        )
      })

      it('should set the attachment filename with .zip extension', function (ctx) {
        sinon.assert.calledWith(ctx.res.attachment, 'output.zip')
      })
    })

    describe('with conversionType=html', function () {
      beforeEach(async function (ctx) {
        ctx.req.query = { type: 'html' }
        ctx.fs.stat.resolves(ctx.documentStat)

        await ctx.ConversionController.convertProjectToDocument(
          ctx.req,
          ctx.res,
          sinon.stub()
        )
      })

      it('should call convertLaTeXToDocumentInDirWithLock with type=html', function (ctx) {
        sinon.assert.calledWith(
          ctx.ConversionManager.promises.convertLaTeXToDocumentInDirWithLock,
          sinon.match(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
          ),
          sinon.match(
            /^\/compiles\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
          ),
          'main.tex',
          'html'
        )
      })

      it('should set the attachment filename with .zip extension', function (ctx) {
        sinon.assert.calledWith(ctx.res.attachment, 'output.zip')
      })
    })

    describe('when conversion fails', function () {
      beforeEach(async function (ctx) {
        ctx.next = sinon.stub()
        ctx.ConversionManager.promises.convertLaTeXToDocumentInDirWithLock.rejects(
          new Error('mock conversion error')
        )

        await ctx.ConversionController.convertProjectToDocument(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should pass the error to next', function (ctx) {
        sinon.assert.calledOnce(ctx.next)
        expect(ctx.next.firstCall.args[0]).to.be.instanceOf(Error)
      })

      it('should still clean up the conversion directory', function (ctx) {
        sinon.assert.calledWith(ctx.fs.rm, sinon.match(uuidDirPattern), {
          recursive: true,
          force: true,
        })
      })
    })

    describe('when conversion fails with a user-facing ConversionError', function () {
      beforeEach(async function (ctx) {
        ctx.next = sinon.stub()
        ctx.jsonStub = sinon.stub()
        ctx.res.status = sinon.stub().returns({ json: ctx.jsonStub })
        ctx.ConversionManager.promises.convertLaTeXToDocumentInDirWithLock.rejects(
          new Errors.ConversionError(
            'pandoc latex-to-document conversion failed',
            {
              type: 'docx',
              exitCode: 64,
              stderr: 'parse error at line 5',
            }
          )
        )

        await ctx.ConversionController.convertProjectToDocument(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should return 422 with the pandoc stderr in the response body', function (ctx) {
        sinon.assert.calledWith(ctx.res.status, 422)
        sinon.assert.calledWith(ctx.jsonStub, {
          error: 'parse error at line 5',
          exitCode: 64,
        })
      })

      it('should not call next', function (ctx) {
        sinon.assert.notCalled(ctx.next)
      })

      it('should still clean up the conversion directory', function (ctx) {
        sinon.assert.calledWith(ctx.fs.rm, sinon.match(uuidDirPattern), {
          recursive: true,
          force: true,
        })
      })
    })

    describe('when conversion fails with a non-user-facing ConversionError', function () {
      beforeEach(async function (ctx) {
        ctx.next = sinon.stub()
        ctx.jsonStub = sinon.stub()
        ctx.res.status = sinon.stub().returns({ json: ctx.jsonStub })
        ctx.ConversionManager.promises.convertLaTeXToDocumentInDirWithLock.rejects(
          new Errors.ConversionError(
            'pandoc latex-to-document conversion failed',
            {
              type: 'docx',
              exitCode: 62,
              stderr: 'internal pandoc bug',
            }
          )
        )

        await ctx.ConversionController.convertProjectToDocument(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should return 422 without surfacing stderr', function (ctx) {
        sinon.assert.calledWith(ctx.res.status, 422)
        sinon.assert.calledWith(ctx.jsonStub, {})
      })

      it('should not call next', function (ctx) {
        sinon.assert.notCalled(ctx.next)
      })

      it('should still clean up the conversion directory', function (ctx) {
        sinon.assert.calledWith(ctx.fs.rm, sinon.match(uuidDirPattern), {
          recursive: true,
          force: true,
        })
      })
    })
  })
})
