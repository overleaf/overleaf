import { describe, expect, vi, beforeEach } from 'vitest'
import sinon from 'sinon'
import FormData from 'form-data'
import {
  FileTooLargeError,
  DocumentConversionError,
} from '../../../../app/src/Features/Errors/Errors.js'

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
      fetchJsonWithResponse: sinon.stub().resolves(),
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
          downloadHost: 'http://mock-clsi-download-host',
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
      fetchJsonWithResponse: ctx.fetchUtils.fetchJsonWithResponse,
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
    ctx.getClsiServerIdFromResponse = sinon.stub().returns('mock-clsi-server')

    ctx.ClsiManager = {
      getClsiServerIdFromResponse: ctx.getClsiServerIdFromResponse,
      CLSI_COOKIES_ENABLED: true,
      promises: {
        buildDocumentConversionRequest: sinon
          .stub()
          .resolves({ some: 'clsi-request' }),
      },
    }

    vi.doMock('../../../../app/src/Features/Compile/ClsiManager.mjs', () => ({
      default: ctx.ClsiManager,
    }))

    ctx.DocumentConversionManager = (await import(MODULE_PATH)).default
  })

  describe('convertDocumentToLaTeXZipArchive', function () {
    describe('with conversionType=docx', function () {
      describe('successfully', function () {
        beforeEach(async function (ctx) {
          ctx.path = '/path/to/input.docx'
          ctx.userId = 'test-user-id'
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
            await ctx.DocumentConversionManager.promises.convertDocumentToLaTeXZipArchive(
              ctx.path,
              ctx.userId,
              'docx'
            )
        })

        it('should call fetchStreamWithResponse with the correct URL and form data', function (ctx) {
          const expectedUrl = new URL(ctx.Settings.apis.clsi.url)
          // TODO: revert this to '/convert/document-to-latex' once the deploy is done (PR #32857)
          expectedUrl.pathname = '/convert/docx-to-latex'
          expectedUrl.searchParams.set(
            'compileBackendClass',
            'test-backend-class'
          )
          expectedUrl.searchParams.set('compileGroup', 'test-compile-group')
          expectedUrl.searchParams.set('type', 'docx')

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
            /\/path\/to\/dump\/folder\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}_document-conversion\.zip/
          )
        })
      })
    })

    describe('with conversionType=markdown', function () {
      beforeEach(async function (ctx) {
        ctx.path = '/path/to/input.md'
        ctx.userId = 'test-user-id'
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
          await ctx.DocumentConversionManager.promises.convertDocumentToLaTeXZipArchive(
            ctx.path,
            ctx.userId,
            'markdown'
          )
      })

      it('should call fetchStreamWithResponse with the correct URL including markdown type', function (ctx) {
        const expectedUrl = new URL(ctx.Settings.apis.clsi.url)
        expectedUrl.pathname = '/convert/document-to-latex'
        expectedUrl.searchParams.set(
          'compileBackendClass',
          'test-backend-class'
        )
        expectedUrl.searchParams.set('compileGroup', 'test-compile-group')
        expectedUrl.searchParams.set('type', 'markdown')

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
          /\/path\/to\/dump\/folder\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}_document-conversion\.zip/
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
          ctx.DocumentConversionManager.promises.convertDocumentToLaTeXZipArchive(
            ctx.path,
            ctx.userId,
            'docx'
          )
        ).to.be.rejectedWith('document conversion failed')
      })

      it('should attempt to clean up the output file', function (ctx) {
        sinon.assert.calledWith(
          ctx.fsPromises.unlink,
          sinon.match(
            /\/path\/to\/dump\/folder\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}_document-conversion\.zip/
          )
        )
      })
    })

    describe('when CLSI returns a 422 with a user-facing JSON body', function () {
      it('should reject with a DocumentConversionError carrying the pandoc message', async function (ctx) {
        const clsiError = new Error('Bad Request')
        clsiError.response = { status: 422 }
        clsiError.body = JSON.stringify({
          error: 'parse error at line 5',
          exitCode: 64,
        })
        ctx.fetchUtils.fetchStreamWithResponse.rejects(clsiError)

        await expect(
          ctx.DocumentConversionManager.promises.convertDocumentToLaTeXZipArchive(
            '/path/to/input.docx',
            'test-user-id',
            'docx'
          )
        ).to.be.rejectedWith(
          sinon.match
            .instanceOf(DocumentConversionError)
            .and(sinon.match.has('message', 'parse error at line 5'))
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
          ctx.DocumentConversionManager.promises.convertDocumentToLaTeXZipArchive(
            ctx.path,
            ctx.userId,
            'docx'
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
            /\/path\/to\/dump\/folder\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}_document-conversion\.zip/
          )
        )
      })
    })
  })

  describe('convertProjectToDocument', function () {
    beforeEach(function (ctx) {
      ctx.projectId = 'test-project-id'
      ctx.userId = 'test-user-id'
      ctx.type = 'docx'
      ctx.conversionId = '12345678-1234-4234-8234-123456789012'
      ctx.buildId = '0123456789a-0123456789abcdef'
      ctx.file = 'output.docx'
      ctx.postResponse = { headers: {} }
      ctx.fetchUtils.fetchJsonWithResponse.resolves({
        json: {
          conversionId: ctx.conversionId,
          buildId: ctx.buildId,
          file: ctx.file,
        },
        response: ctx.postResponse,
      })
    })

    describe('successfully', function () {
      beforeEach(async function (ctx) {
        ctx.result =
          await ctx.DocumentConversionManager.promises.convertProjectToDocument(
            ctx.projectId,
            ctx.userId,
            ctx.type,
            {
              compileFromHistory: false,
              rootDocPath: 'main.tex',
            }
          )
      })

      it('should build the CLSI document conversion request', function (ctx) {
        sinon.assert.calledWith(
          ctx.ClsiManager.promises.buildDocumentConversionRequest,
          ctx.projectId
        )
      })

      it('should POST to CLSI with responseFormat=json and compile metadata', function (ctx) {
        const expectedUrl = new URL(ctx.Settings.apis.clsi.url)
        expectedUrl.pathname = `/project/${ctx.projectId}/user/${ctx.userId}/download/project-to-document`
        expectedUrl.searchParams.set('type', ctx.type)
        expectedUrl.searchParams.set('responseFormat', 'json')
        expectedUrl.searchParams.set(
          'compileBackendClass',
          'test-backend-class'
        )
        expectedUrl.searchParams.set('compileGroup', 'test-compile-group')

        sinon.assert.calledWith(
          ctx.fetchUtils.fetchJsonWithResponse,
          sinon.match(url => url.toString() === expectedUrl.toString()),
          { method: 'POST', json: { some: 'clsi-request' } }
        )
      })

      it('should extract clsiServerId from the POST response cookie', function (ctx) {
        sinon.assert.calledWith(
          ctx.getClsiServerIdFromResponse,
          ctx.postResponse
        )
      })

      it('should return the conversion identifiers', function (ctx) {
        expect(ctx.result).to.deep.equal({
          conversionId: ctx.conversionId,
          buildId: ctx.buildId,
          clsiServerId: 'mock-clsi-server',
          file: ctx.file,
        })
      })
    })

    describe('when CLSI returns a 422 with a user-facing JSON body', function () {
      it('should reject with a DocumentConversionError carrying the pandoc message', async function (ctx) {
        const clsiError = new Error('Bad Request')
        clsiError.response = { status: 422 }
        clsiError.body = JSON.stringify({ error: 'parse error at line 5' })
        ctx.fetchUtils.fetchJsonWithResponse.rejects(clsiError)

        await expect(
          ctx.DocumentConversionManager.promises.convertProjectToDocument(
            'project-id',
            'user-id',
            'docx',
            {
              compileFromHistory: false,
              rootDocPath: 'main.tex',
            }
          )
        ).to.be.rejectedWith(
          sinon.match
            .instanceOf(DocumentConversionError)
            .and(sinon.match.has('message', 'parse error at line 5'))
        )
      })
    })

    describe('when CLSI returns a non-422 error', function () {
      it('should rethrow the original error', async function (ctx) {
        const clsiError = new Error('boom')
        clsiError.response = { status: 500 }
        ctx.fetchUtils.fetchJsonWithResponse.rejects(clsiError)

        await expect(
          ctx.DocumentConversionManager.promises.convertProjectToDocument(
            'project-id',
            'user-id',
            'docx',
            {
              compileFromHistory: false,
              rootDocPath: 'main.tex',
            }
          )
        ).to.be.rejectedWith('boom')
      })
    })
  })

  describe('streamConvertedProjectDocument', function () {
    beforeEach(function (ctx) {
      ctx.conversionId = '12345678-1234-4234-8234-123456789012'
      ctx.buildId = '0123456789a-0123456789abcdef'
      ctx.file = 'output.docx'
      ctx.clsiServerId = 'clsi-server-1'
      ctx.mockStream = { destroy: sinon.stub() }
      ctx.response = {
        headers: { get: sinon.stub().returns(null) },
      }
      ctx.response.headers.get.withArgs('Content-Length').returns('50')
      ctx.fetchUtils.fetchStreamWithResponse.resolves({
        stream: ctx.mockStream,
        response: ctx.response,
      })
    })

    describe('with a clsiServerId', function () {
      beforeEach(async function (ctx) {
        ctx.result =
          await ctx.DocumentConversionManager.promises.streamConvertedProjectDocument(
            {
              conversionId: ctx.conversionId,
              buildId: ctx.buildId,
              clsiServerId: ctx.clsiServerId,
              file: ctx.file,
            }
          )
      })

      it('should GET the file from clsi-nginx with the clsiserverid query param', function (ctx) {
        const expectedUrl = new URL(ctx.Settings.apis.clsi.downloadHost)
        expectedUrl.pathname = `/project/${ctx.conversionId}/build/${ctx.buildId}/output/${ctx.file}`
        expectedUrl.searchParams.set('clsiserverid', ctx.clsiServerId)

        sinon.assert.calledWith(
          ctx.fetchUtils.fetchStreamWithResponse,
          sinon.match(url => url.toString() === expectedUrl.toString())
        )
      })

      it('should return the stream and content length', function (ctx) {
        expect(ctx.result).to.deep.equal({
          stream: ctx.mockStream,
          contentLength: 50,
        })
      })
    })

    describe('without a clsiServerId', function () {
      beforeEach(async function (ctx) {
        await ctx.DocumentConversionManager.promises.streamConvertedProjectDocument(
          {
            conversionId: ctx.conversionId,
            buildId: ctx.buildId,
            clsiServerId: undefined,
            file: ctx.file,
          }
        )
      })

      it('should not include the clsiserverid query param', function (ctx) {
        const url = ctx.fetchUtils.fetchStreamWithResponse.firstCall.args[0]
        expect(url.searchParams.has('clsiserverid')).to.equal(false)
      })
    })
  })
})
