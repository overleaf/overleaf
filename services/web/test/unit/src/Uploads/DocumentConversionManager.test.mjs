import { describe, expect, vi, beforeEach } from 'vitest'
import sinon from 'sinon'
import FormData from 'form-data'
import { FileTooLargeError } from '../../../../app/src/Features/Errors/Errors.js'

const MODULE_PATH =
  '../../../../app/src/Features/Uploads/DocumentConversionManager.mjs'

describe('DocumentConversionManager', function () {
  beforeEach(async function (ctx) {
    ctx.fs = {
      createReadStream: sinon.stub().returns('mocked-read-stream'),
      createWriteStream: sinon.stub().returns('mocked-write-stream'),
    }

    ctx.fsPromises = {
      unlink: sinon.stub().resolves(),
    }

    ctx.fetchUtils = {
      fetchStreamWithResponse: sinon.stub().resolves(),
    }

    ctx.nodeStream = {
      pipeline: sinon.stub().resolves(),
    }

    ctx.CompileManager = {
      promises: {
        _getUserCompileLimits: sinon.stub().resolves({
          compileBackendClass: 'test-backend-class',
          compileGroup: 'test-compile-group',
        }),
      },
    }

    ctx.Settings = {
      maxUploadSize: 100,
      path: {
        dumpFolder: '/path/to/dump/folder',
      },
      apis: {
        clsi: {
          url: 'http://mock-clsi-url',
        },
      },
    }

    vi.doMock('node:fs', () => ({
      default: ctx.fs,
    }))

    vi.doMock('node:fs/promises', () => ({
      default: ctx.fsPromises,
    }))

    vi.doMock('@overleaf/fetch-utils', () => ({
      fetchStreamWithResponse: ctx.fetchUtils.fetchStreamWithResponse,
    }))

    vi.doMock('node:stream/promises', () => ({
      pipeline: ctx.nodeStream.pipeline,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.Settings,
    }))

    vi.doMock(
      '../../../../app/src/Features/Compile/CompileManager.mjs',
      () => ({
        default: ctx.CompileManager,
      })
    )

    ctx.DocumentConversionManager = (await import(MODULE_PATH)).default
  })

  describe('convertDocxToLaTeXZipArchive', function () {
    describe('successfully', function () {
      beforeEach(async function (ctx) {
        ctx.path = '/path/to/input.docx'
        ctx.userId = 'test-user-id'
        ctx.outputPath = '/path/to/output.zip'
        ctx.response = {
          headers: {
            get: sinon.stub().returns(null),
          },
        }
        ctx.response.headers.get.withArgs('Content-Length').returns('50')

        ctx.fetchUtils.fetchStreamWithResponse.resolves({
          stream: 'mocked-fetch-stream',
          response: ctx.response,
        })

        ctx.result =
          await ctx.DocumentConversionManager.promises.convertDocxToLaTeXZipArchive(
            ctx.path,
            ctx.userId
          )
      })

      it('should call fetchStreamWithResponse with the correct URL and form data', function (ctx) {
        const expectedUrl = new URL(ctx.Settings.apis.clsi.url)
        expectedUrl.pathname = '/convert/docx-to-latex'
        expectedUrl.searchParams.set(
          'compileBackendClass',
          'test-backend-class'
        )
        expectedUrl.searchParams.set('compileGroup', 'test-compile-group')

        sinon.assert.calledWith(
          ctx.fetchUtils.fetchStreamWithResponse,
          sinon.match(url => url.toString() === expectedUrl.toString()),
          {
            method: 'POST',
            body: sinon.match.instanceOf(FormData),
            signal: sinon.match.instanceOf(AbortSignal),
          }
        )
      })

      it('should pipe result into the output file', function (ctx) {
        sinon.assert.calledWith(
          ctx.nodeStream.pipeline,
          'mocked-fetch-stream',
          'mocked-write-stream'
        )
      })

      it('should return a path to the output file', function (ctx) {
        expect(ctx.result).to.match(
          /\/path\/to\/dump\/folder\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.zip/
        )
      })
    })

    describe('when an error occurs during conversion', function () {
      beforeEach(async function (ctx) {
        ctx.path = '/path/to/input.docx'
        ctx.userId = 'test-user-id'

        ctx.fetchUtils.fetchStreamWithResponse.rejects(
          new Error('Conversion failed')
        )

        await expect(
          ctx.DocumentConversionManager.promises.convertDocxToLaTeXZipArchive(
            ctx.path,
            ctx.userId
          )
        ).to.be.rejectedWith('document conversion failed')
      })

      it('should attempt to clean up the output file', function (ctx) {
        sinon.assert.calledWith(
          ctx.fsPromises.unlink,
          sinon.match(
            /\/path\/to\/dump\/folder\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.zip/
          )
        )
      })
    })

    describe('when the converted archive is too large', function () {
      beforeEach(async function (ctx) {
        ctx.path = '/path/to/input.docx'
        ctx.userId = 'test-user-id'
        ctx.stream = {
          destroy: sinon.stub(),
        }
        ctx.response = {
          headers: {
            get: sinon.stub(),
          },
        }
        ctx.response.headers.get.withArgs('Content-Length').returns('150')

        ctx.fetchUtils.fetchStreamWithResponse.resolves({
          stream: ctx.stream,
          response: ctx.response,
        })

        await expect(
          ctx.DocumentConversionManager.promises.convertDocxToLaTeXZipArchive(
            ctx.path,
            ctx.userId
          )
        ).to.be.rejectedWith(sinon.match.instanceOf(FileTooLargeError))
      })

      it('should abort the request', function (ctx) {
        expect(
          ctx.fetchUtils.fetchStreamWithResponse.firstCall.args[1].signal
            .aborted
        ).to.equal(true)
      })

      it('should destroy the response stream', function (ctx) {
        sinon.assert.calledOnce(ctx.stream.destroy)
      })

      it('should not write the oversized archive to disk', function (ctx) {
        sinon.assert.notCalled(ctx.fs.createWriteStream)
        sinon.assert.notCalled(ctx.nodeStream.pipeline)
      })

      it('should attempt to clean up the output path', function (ctx) {
        sinon.assert.calledWith(
          ctx.fsPromises.unlink,
          sinon.match(
            /\/path\/to\/dump\/folder\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.zip/
          )
        )
      })
    })

    describe('when the Content-Length header is missing', function () {
      beforeEach(async function (ctx) {
        ctx.path = '/path/to/input.docx'
        ctx.userId = 'test-user-id'
        ctx.response = {
          headers: {
            get: sinon.stub().returns(null),
          },
        }

        ctx.fetchUtils.fetchStreamWithResponse.resolves({
          stream: 'mocked-fetch-stream',
          response: ctx.response,
        })

        await expect(
          ctx.DocumentConversionManager.promises.convertDocxToLaTeXZipArchive(
            ctx.path,
            ctx.userId
          )
        ).to.be.rejectedWith('document conversion failed')
      })

      it('should not write the archive to disk', function (ctx) {
        sinon.assert.notCalled(ctx.fs.createWriteStream)
        sinon.assert.notCalled(ctx.nodeStream.pipeline)
      })

      it('should attempt to clean up the output path', function (ctx) {
        sinon.assert.calledWith(
          ctx.fsPromises.unlink,
          sinon.match(
            /\/path\/to\/dump\/folder\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.zip/
          )
        )
      })
    })
  })
})
