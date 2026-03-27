import sinon from 'sinon'
import { vi, describe, it, beforeEach, expect } from 'vitest'
import Path from 'node:path'
import { PassThrough } from 'node:stream'

const MODULE_PATH = Path.join(
  import.meta.dirname,
  '../../../app/js/ConversionController'
)

describe('ConversionController', function () {
  beforeEach(async function (ctx) {
    ctx.conversionDir = '/path/to/conversion/result'
    ctx.zipPath = '/path/to/conversion/result/output.zip'
    ctx.zipStat = { size: 1234 }
    ctx.Settings = {
      enablePandocConversions: true,
    }
    ctx.ConversionManager = {
      promises: {
        convertDocxToLaTeXWithLock: sinon.stub().resolves(ctx.zipPath),
      },
    }

    ctx.fs = {
      stat: sinon.stub().resolves(ctx.zipStat),
      unlink: sinon.stub().resolves(),
      rm: sinon.stub().resolves(),
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

    ctx.res = new PassThrough()
    ctx.res.attachment = sinon.stub()
    ctx.res.setHeader = sinon.stub()

    ctx.ConversionController = (await import(MODULE_PATH)).default
  })

  describe('convertDocxToLaTeX', function () {
    describe('when conversions are disabled', function () {
      beforeEach(async function (ctx) {
        ctx.Settings.enablePandocConversions = false
        ctx.req = {
          file: { path: '/path/to/uploaded/file.docx' },
        }
        ctx.res.sendStatus = sinon.stub()

        await ctx.ConversionController.convertDocxToLaTeX(ctx.req, ctx.res)
      })

      it('should remove the uploaded file', function (ctx) {
        sinon.assert.calledWith(ctx.fs.unlink, ctx.req.file.path)
      })

      it('should return 404', function (ctx) {
        sinon.assert.calledWith(ctx.res.sendStatus, 404)
      })

      it('should not call the conversion manager', function (ctx) {
        sinon.assert.notCalled(
          ctx.ConversionManager.promises.convertDocxToLaTeXWithLock
        )
      })
    })

    describe('successfully', function () {
      beforeEach(async function (ctx) {
        ctx.req = {
          file: { path: '/path/to/uploaded/file.docx' },
        }

        await ctx.ConversionController.convertDocxToLaTeX(ctx.req, ctx.res)
      })

      it('should call the conversion manager with the uploaded file path', function (ctx) {
        sinon.assert.calledWith(
          ctx.ConversionManager.promises.convertDocxToLaTeXWithLock,
          sinon.match(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
          ),
          ctx.req.file.path
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

    describe('unsuccessfully', function () {
      describe('on streaming error', function () {
        it('should propagate the error and still clean up', async function (ctx) {
          ctx.pipeline.rejects(new Error('mock stream error'))

          const res = new PassThrough()
          res.attachment = sinon.stub()
          res.setHeader = sinon.stub()

          const req = { file: { path: '/path/to/uploaded/file.docx' } }

          await expect(
            ctx.ConversionController.convertDocxToLaTeX(req, res)
          ).to.be.rejectedWith('mock stream error')

          sinon.assert.calledWith(ctx.fs.rm, ctx.conversionDir)
        })
      })
    })
  })
})
