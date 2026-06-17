import { vi } from 'vitest'
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import sinon from 'sinon'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'
import { DocumentConversionError } from '../../../../app/src/Features/Errors/Errors.js'

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)
const modulePath =
  '../../../../app/src/Features/Downloads/ProjectDownloadsController.mjs'

describe('ProjectDownloadsController', function () {
  beforeEach(async function (ctx) {
    ctx.project_id = 'project-id-123'
    ctx.req = new MockRequest(vi)
    ctx.res = new MockResponse(vi)
    ctx.next = sinon.stub()
    ctx.DocumentUpdaterHandler = sinon.stub()

    vi.doMock(
      '../../../../app/src/Features/Downloads/ProjectZipStreamManager.mjs',
      () => ({
        default: (ctx.ProjectZipStreamManager = {}),
      })
    )

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter.mjs', () => ({
      default: (ctx.ProjectGetter = {
        promises: {
          getProject: sinon.stub(),
        },
      }),
    }))

    vi.doMock(
      '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler.mjs',
      () => ({
        default: ctx.DocumentUpdaterHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectAuditLogHandler.mjs',
      () => ({
        default: (ctx.ProjectAuditLogHandler = {
          addEntryInBackground: sinon.stub(),
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager.mjs',
      () => ({
        default: (ctx.SessionManager = {
          getLoggedInUserId: sinon
            .stub()
            .callsFake(session => session?.user?._id),
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Uploads/DocumentConversionManager.mjs',
      () => ({
        default: (ctx.DocumentConversionManager = {
          promises: {
            convertProjectToDocument: sinon.stub(),
            streamConvertedProjectDocument: sinon.stub(),
          },
        }),
      })
    )
    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler.mjs',
      () => ({
        default: (ctx.SplitTestHandler = {
          featureFlagEnabled: sinon.stub().yields(null, false),
          promises: {
            featureFlagEnabled: sinon.stub().resolves(false),
          },
        }),
      })
    )

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.Settings = {
        siteUrl: 'https://overleaf.example.com',
      }),
    }))

    vi.doMock('node:stream/promises', () => ({
      pipeline: (ctx.pipeline = sinon.stub().resolves()),
    }))

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager.mjs',
      () => ({
        default: (ctx.AnalyticsManager = {
          recordEventForSession: sinon.stub(),
          recordEventForUserInBackground: sinon.stub(),
        }),
      })
    )

    ctx.ProjectDownloadsController = (await import(modulePath)).default
  })

  describe('downloadProject', function () {
    beforeEach(function (ctx) {
      ctx.stream = { pipe: sinon.stub() }
      ctx.ProjectZipStreamManager.createZipStreamForProject = sinon
        .stub()
        .yields(null, ctx.stream)
      ctx.req.params = { Project_id: ctx.project_id }
      ctx.req.ip = '192.168.1.1'
      ctx.req.session = {
        user: {
          _id: 'user-id-123',
          email: 'user@example.com',
        },
      }
      ctx.project_name = 'project name with accênts and % special characters'
      ctx.ProjectGetter.getProject = sinon.stub().callsArgWith(2, null, {
        name: ctx.project_name,
        overleaf: { history: { id: 123 } },
      })
      ctx.DocumentUpdaterHandler.flushProjectToMongo = sinon
        .stub()
        .callsArgWith(1)
      ctx.Metrics.inc = sinon.stub()
      return ctx.ProjectDownloadsController.downloadProject(
        ctx.req,
        ctx.res,
        ctx.next
      )
    })

    it('should create a zip from the project', function (ctx) {
      return ctx.ProjectZipStreamManager.createZipStreamForProject
        .calledWith(ctx.project_id)
        .should.equal(true)
    })

    it('should stream the zip to the request', function (ctx) {
      return ctx.stream.pipe.calledWith(ctx.res).should.equal(true)
    })

    it('should set the correct content type on the request', function (ctx) {
      expect(ctx.res.contentType).toHaveBeenCalledWith('application/zip')
    })

    it('should flush the project to mongo', function (ctx) {
      return ctx.DocumentUpdaterHandler.flushProjectToMongo
        .calledWith(ctx.project_id)
        .should.equal(true)
    })

    it("should look up the project's name", function (ctx) {
      return ctx.ProjectGetter.getProject
        .calledWith(ctx.project_id, { name: true, 'overleaf.history.id': true })
        .should.equal(true)
    })

    it('should name the downloaded file after the project but sanitise special characters', function (ctx) {
      ctx.res.headers.should.deep.equal({
        'Content-Disposition': `attachment; filename="project_name_with_accênts_and___special_characters.zip"`,
        'Content-Type': 'application/zip',
        'X-Accel-Buffering': 'no',
        'X-Content-Type-Options': 'nosniff',
      })
    })

    it('should record the action via Metrics', function (ctx) {
      return ctx.Metrics.inc.calledWith('zip-downloads').should.equal(true)
    })

    it('should add an audit log entry', function (ctx) {
      return ctx.ProjectAuditLogHandler.addEntryInBackground
        .calledWith(
          ctx.project_id,
          'project-downloaded',
          ctx.req.session.user._id,
          ctx.req.ip
        )
        .should.equal(true)
    })
  })

  describe('downloadMultipleProjects', function () {
    beforeEach(function (ctx) {
      ctx.stream = { pipe: sinon.stub() }
      ctx.ProjectZipStreamManager.createZipStreamForMultipleProjects = sinon
        .stub()
        .yields(null, ctx.stream)
      ctx.project_ids = ['project-1', 'project-2']
      ctx.req.query = { project_ids: ctx.project_ids.join(',') }
      ctx.req.ip = '192.168.1.1'
      ctx.req.session = {
        user: {
          _id: 'user-id-123',
          email: 'user@example.com',
        },
      }
      ctx.DocumentUpdaterHandler.flushMultipleProjectsToMongo = sinon
        .stub()
        .callsArgWith(1)
      ctx.Metrics.inc = sinon.stub()
      return ctx.ProjectDownloadsController.downloadMultipleProjects(
        ctx.req,
        ctx.res,
        ctx.next
      )
    })

    it('should create a zip from the project', function (ctx) {
      return ctx.ProjectZipStreamManager.createZipStreamForMultipleProjects
        .calledWith(ctx.project_ids)
        .should.equal(true)
    })

    it('should stream the zip to the request', function (ctx) {
      return ctx.stream.pipe.calledWith(ctx.res).should.equal(true)
    })

    it('should set the correct content type on the request', function (ctx) {
      expect(ctx.res.contentType).toHaveBeenCalledWith('application/zip')
    })

    it('should flush the projects to mongo', function (ctx) {
      return ctx.DocumentUpdaterHandler.flushMultipleProjectsToMongo
        .calledWith(ctx.project_ids)
        .should.equal(true)
    })

    it('should name the downloaded file after the project', function (ctx) {
      ctx.res.headers.should.deep.equal({
        'Content-Disposition':
          'attachment; filename="Overleaf Projects (2 items).zip"',
        'Content-Type': 'application/zip',
        'X-Accel-Buffering': 'no',
        'X-Content-Type-Options': 'nosniff',
      })
    })

    it('should record the action via Metrics', function (ctx) {
      return ctx.Metrics.inc
        .calledWith('zip-downloads-multiple')
        .should.equal(true)
    })

    it('should add an audit log entry for each project', function (ctx) {
      ctx.ProjectAuditLogHandler.addEntryInBackground.callCount.should.equal(
        ctx.project_ids.length
      )
      for (const projectId of ctx.project_ids) {
        ctx.ProjectAuditLogHandler.addEntryInBackground
          .calledWith(
            projectId,
            'project-downloaded',
            ctx.req.session.user._id,
            ctx.req.ip
          )
          .should.equal(true)
      }
    })
  })

  describe('exportProjectConversion', function () {
    describe('with a supported type (default streaming)', function () {
      beforeEach(async function (ctx) {
        ctx.projectId = '5e9b1c2a3b4c5d6e7f8a9b0c'
        ctx.userId = 'test-user-id'
        ctx.projectName = 'My Test Project'
        ctx.exportStream = { pipe: sinon.stub() }
        ctx.contentLength = 9876
        ctx.conversionIds = {
          conversionId: '12345678-1234-4234-8234-123456789012',
          buildId: '0123456789a-0123456789abcdef',
          clsiServerId: 'clsi-server-1',
          file: 'output.docx',
        }

        ctx.req.params = { Project_id: ctx.projectId, type: 'docx' }
        ctx.req.session = { user: { _id: ctx.userId } }
        ctx.req.query = {}
        ctx.req.ip = '192.168.1.1'

        ctx.res.attachment = sinon.stub().returns(ctx.res)

        ctx.SessionManager.getLoggedInUserId.returns(ctx.userId)
        ctx.ProjectGetter.promises.getProject.resolves({
          name: ctx.projectName,
        })
        ctx.DocumentConversionManager.promises.convertProjectToDocument.resolves(
          ctx.conversionIds
        )
        ctx.DocumentConversionManager.promises.streamConvertedProjectDocument.resolves(
          {
            stream: ctx.exportStream,
            contentLength: ctx.contentLength,
          }
        )

        await ctx.ProjectDownloadsController.exportProjectConversion(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should call convertProjectToDocument with the docx type', function (ctx) {
        sinon.assert.calledWith(
          ctx.DocumentConversionManager.promises.convertProjectToDocument,
          ctx.projectId,
          ctx.userId,
          'docx'
        )
      })

      it('should fetch the prepared document via streamConvertedProjectDocument', function (ctx) {
        sinon.assert.calledWith(
          ctx.DocumentConversionManager.promises.streamConvertedProjectDocument,
          ctx.conversionIds
        )
      })

      it('should set the Content-Length header', function (ctx) {
        expect(ctx.res.headers['Content-Length']).to.equal(ctx.contentLength)
      })

      it('should set the attachment filename with safe project name', function (ctx) {
        sinon.assert.calledWith(ctx.res.attachment, 'My_Test_Project.docx')
      })

      it('should set the X-Content-Type-Options header', function (ctx) {
        expect(ctx.res.headers['X-Content-Type-Options']).to.equal('nosniff')
      })

      it('should set the X-Accel-Buffering header', function (ctx) {
        expect(ctx.res.headers['X-Accel-Buffering']).to.equal('no')
      })

      it('should add an audit log entry', function (ctx) {
        sinon.assert.calledWith(
          ctx.ProjectAuditLogHandler.addEntryInBackground,
          ctx.projectId,
          'project-exported-docx',
          ctx.userId,
          ctx.req.ip
        )
      })

      it('should record the action via Metrics', function (ctx) {
        ctx.Metrics.inc
          .calledWith('document-exports', 1, { type: 'docx' })
          .should.equal(true)
      })

      it('should stream the document to the response', function (ctx) {
        sinon.assert.calledWith(ctx.pipeline, ctx.exportStream, ctx.res)
      })

      it('should record a successful convert-format analytics event', function (ctx) {
        sinon.assert.calledWith(
          ctx.AnalyticsManager.recordEventForSession,
          ctx.req.session,
          'convert-format',
          {
            sourceFormat: 'latex',
            targetFormat: 'docx',
            status: 'success',
            operation: 'export',
          }
        )
      })
    })

    describe('with responseFormat=json', function () {
      beforeEach(async function (ctx) {
        ctx.projectId = '5e9b1c2a3b4c5d6e7f8a9b0c'
        ctx.userId = 'test-user-id'
        ctx.req.params = { Project_id: ctx.projectId, type: 'docx' }
        ctx.req.query = { responseFormat: 'json' }
        ctx.req.session = { user: { _id: ctx.userId } }
        ctx.req.ip = '192.168.1.1'

        ctx.res.json = sinon.stub().returns(ctx.res)

        ctx.SessionManager.getLoggedInUserId.returns(ctx.userId)
        ctx.DocumentConversionManager.promises.convertProjectToDocument.resolves(
          {
            conversionId: '12345678-1234-4234-8234-123456789012',
            buildId: '0123456789a-0123456789abcdef',
            clsiServerId: 'clsi-server-1',
            file: 'output.docx',
          }
        )

        await ctx.ProjectDownloadsController.exportProjectConversion(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should call convertProjectToDocument', function (ctx) {
        sinon.assert.calledWith(
          ctx.DocumentConversionManager.promises.convertProjectToDocument,
          ctx.projectId,
          ctx.userId,
          'docx'
        )
      })

      it('should not stream a document', function (ctx) {
        sinon.assert.notCalled(
          ctx.DocumentConversionManager.promises.streamConvertedProjectDocument
        )
        sinon.assert.notCalled(ctx.pipeline)
      })

      it('should add an audit log entry', function (ctx) {
        sinon.assert.calledWith(
          ctx.ProjectAuditLogHandler.addEntryInBackground,
          ctx.projectId,
          'project-exported-docx',
          ctx.userId,
          ctx.req.ip
        )
      })

      it('should respond with a download URL pointing at the prepared output route', function (ctx) {
        sinon.assert.calledOnce(ctx.res.json)
        const arg = ctx.res.json.firstCall.args[0]
        expect(arg.downloadUrl).to.equal(
          '/project/5e9b1c2a3b4c5d6e7f8a9b0c/download/conversion/12345678-1234-4234-8234-123456789012/docx/build/0123456789a-0123456789abcdef/output/output.docx?clsiserverid=clsi-server-1'
        )
      })

      it('should omit the clsiserverid param when no clsiServerId is returned', async function (ctx) {
        ctx.res.json.resetHistory()
        ctx.DocumentConversionManager.promises.convertProjectToDocument.resolves(
          {
            conversionId: '12345678-1234-4234-8234-123456789012',
            buildId: '0123456789a-0123456789abcdef',
            clsiServerId: null,
            file: 'output.docx',
          }
        )

        await ctx.ProjectDownloadsController.exportProjectConversion(
          ctx.req,
          ctx.res,
          ctx.next
        )
        const arg = ctx.res.json.firstCall.args[0]
        const url = new URL(arg.downloadUrl, 'http://localhost')
        expect(url.searchParams.has('clsiserverid')).to.equal(false)
      })
    })

    describe('with type=markdown', function () {
      beforeEach(async function (ctx) {
        ctx.projectId = '5e9b1c2a3b4c5d6e7f8a9b0c'
        ctx.userId = 'test-user-id'
        ctx.projectName = 'My Test Project'
        ctx.exportStream = { pipe: sinon.stub() }
        ctx.contentLength = 9876

        ctx.req.params = { Project_id: ctx.projectId, type: 'markdown' }
        ctx.req.session = { user: { _id: ctx.userId } }
        ctx.req.query = {}
        ctx.req.ip = '192.168.1.1'

        ctx.res.attachment = sinon.stub().returns(ctx.res)

        ctx.SessionManager.getLoggedInUserId.returns(ctx.userId)
        ctx.ProjectGetter.promises.getProject.resolves({
          name: ctx.projectName,
        })
        ctx.DocumentConversionManager.promises.convertProjectToDocument.resolves(
          {
            conversionId: '12345678-1234-4234-8234-123456789012',
            buildId: '0123456789a-0123456789abcdef',
            clsiServerId: 'clsi-server-1',
            file: 'output.zip',
          }
        )
        ctx.DocumentConversionManager.promises.streamConvertedProjectDocument.resolves(
          {
            stream: ctx.exportStream,
            contentLength: ctx.contentLength,
          }
        )

        await ctx.ProjectDownloadsController.exportProjectConversion(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should call convertProjectToDocument with the markdown type', function (ctx) {
        sinon.assert.calledWith(
          ctx.DocumentConversionManager.promises.convertProjectToDocument,
          ctx.projectId,
          ctx.userId,
          'markdown'
        )
      })

      it('should set the attachment filename with .zip extension', function (ctx) {
        sinon.assert.calledWith(ctx.res.attachment, 'My_Test_Project.zip')
      })

      it('should add an audit log entry for markdown export', function (ctx) {
        sinon.assert.calledWith(
          ctx.ProjectAuditLogHandler.addEntryInBackground,
          ctx.projectId,
          'project-exported-markdown',
          ctx.userId,
          ctx.req.ip
        )
      })

      it('should record the action via Metrics with markdown type', function (ctx) {
        ctx.Metrics.inc
          .calledWith('document-exports', 1, { type: 'markdown' })
          .should.equal(true)
      })

      it('should stream the document to the response', function (ctx) {
        sinon.assert.calledWith(ctx.pipeline, ctx.exportStream, ctx.res)
      })
    })

    describe('with type=html', function () {
      beforeEach(async function (ctx) {
        ctx.projectId = '5e9b1c2a3b4c5d6e7f8a9b0c'
        ctx.userId = 'test-user-id'
        ctx.projectName = 'My Test Project'
        ctx.exportStream = { pipe: sinon.stub() }
        ctx.contentLength = 9876

        ctx.req.params = { Project_id: ctx.projectId, type: 'html' }
        ctx.req.session = { user: { _id: ctx.userId } }
        ctx.req.query = {}
        ctx.req.ip = '192.168.1.1'

        ctx.res.attachment = sinon.stub().returns(ctx.res)

        ctx.SessionManager.getLoggedInUserId.returns(ctx.userId)
        ctx.ProjectGetter.promises.getProject.resolves({
          name: ctx.projectName,
        })
        ctx.DocumentConversionManager.promises.convertProjectToDocument.resolves(
          {
            conversionId: '12345678-1234-4234-8234-123456789012',
            buildId: '0123456789a-0123456789abcdef',
            clsiServerId: 'clsi-server-1',
            file: 'output.zip',
          }
        )
        ctx.DocumentConversionManager.promises.streamConvertedProjectDocument.resolves(
          {
            stream: ctx.exportStream,
            contentLength: ctx.contentLength,
          }
        )

        await ctx.ProjectDownloadsController.exportProjectConversion(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should call convertProjectToDocument with the html type', function (ctx) {
        sinon.assert.calledWith(
          ctx.DocumentConversionManager.promises.convertProjectToDocument,
          ctx.projectId,
          ctx.userId,
          'html'
        )
      })

      it('should set the attachment filename with .zip extension', function (ctx) {
        sinon.assert.calledWith(ctx.res.attachment, 'My_Test_Project.zip')
      })

      it('should add an audit log entry for html export', function (ctx) {
        sinon.assert.calledWith(
          ctx.ProjectAuditLogHandler.addEntryInBackground,
          ctx.projectId,
          'project-exported-html',
          ctx.userId,
          ctx.req.ip
        )
      })

      it('should record the action via Metrics with html type', function (ctx) {
        ctx.Metrics.inc
          .calledWith('document-exports', 1, { type: 'html' })
          .should.equal(true)
      })

      it('should stream the document to the response', function (ctx) {
        sinon.assert.calledWith(ctx.pipeline, ctx.exportStream, ctx.res)
      })
    })

    describe('when conversion fails with a DocumentConversionError', function () {
      beforeEach(async function (ctx) {
        ctx.projectId = '5e9b1c2a3b4c5d6e7f8a9b0c'
        ctx.userId = 'test-user-id'
        ctx.req.params = { Project_id: ctx.projectId, type: 'docx' }
        ctx.req.query = {}
        ctx.req.session = { user: { _id: ctx.userId } }

        ctx.res.json = sinon.stub().returns(ctx.res)

        ctx.SessionManager.getLoggedInUserId.returns(ctx.userId)
        ctx.DocumentConversionManager.promises.convertProjectToDocument.rejects(
          new DocumentConversionError('parse error at line 5')
        )

        await ctx.ProjectDownloadsController.exportProjectConversion(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should respond with 422 and the pandoc message', function (ctx) {
        expect(ctx.res.statusCode).to.equal(422)
        sinon.assert.calledWith(ctx.res.json, {
          error: 'parse error at line 5',
        })
      })

      it('should not call next', function (ctx) {
        sinon.assert.notCalled(ctx.next)
      })

      it('should not attempt to stream a document', function (ctx) {
        sinon.assert.notCalled(
          ctx.DocumentConversionManager.promises.streamConvertedProjectDocument
        )
      })
    })
  })

  describe('downloadPreparedProjectExport', function () {
    describe('with a supported type', function () {
      beforeEach(async function (ctx) {
        ctx.projectId = '5e9b1c2a3b4c5d6e7f8a9b0c'
        ctx.projectName = 'My Test Project'
        ctx.exportStream = { pipe: sinon.stub() }
        ctx.contentLength = 9876

        ctx.req.params = {
          Project_id: ctx.projectId,
          type: 'docx',
          conversionId: '12345678-1234-4234-8234-123456789012',
          buildId: '0123456789a-0123456789abcdef',
          file: 'output.docx',
        }
        ctx.req.query = {
          clsiserverid: 'clsi-server-1',
        }

        ctx.res.attachment = sinon.stub().returns(ctx.res)

        ctx.ProjectGetter.promises.getProject.resolves({
          name: ctx.projectName,
        })
        ctx.DocumentConversionManager.promises.streamConvertedProjectDocument.resolves(
          {
            stream: ctx.exportStream,
            contentLength: ctx.contentLength,
          }
        )

        await ctx.ProjectDownloadsController.downloadPreparedProjectExport(
          ctx.req,
          ctx.res,
          ctx.next
        )
      })

      it('should call streamConvertedProjectDocument with the query params', function (ctx) {
        sinon.assert.calledWith(
          ctx.DocumentConversionManager.promises.streamConvertedProjectDocument,
          {
            conversionId: '12345678-1234-4234-8234-123456789012',
            buildId: '0123456789a-0123456789abcdef',
            clsiServerId: 'clsi-server-1',
            file: 'output.docx',
          }
        )
      })

      it('should set the attachment filename with safe project name', function (ctx) {
        sinon.assert.calledWith(ctx.res.attachment, 'My_Test_Project.docx')
      })

      it('should set the Content-Length header', function (ctx) {
        expect(ctx.res.headers['Content-Length']).to.equal(ctx.contentLength)
      })

      it('should stream the document to the response', function (ctx) {
        sinon.assert.calledWith(ctx.pipeline, ctx.exportStream, ctx.res)
      })

      it('should not log an audit entry', function (ctx) {
        sinon.assert.notCalled(ctx.ProjectAuditLogHandler.addEntryInBackground)
      })
    })
  })
})
