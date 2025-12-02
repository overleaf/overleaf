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
      default: (ctx.ProjectGetter = {}),
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: (ctx.metrics = {}),
    }))

    vi.doMock(
      '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler.mjs',
      () => ({
        default: ctx.DocumentUpdaterHandler,
      })
    )

    ctx.ProjectDownloadsController = (await import(modulePath)).default
  })

  describe('downloadProject', function () {
    beforeEach(function (ctx) {
      ctx.stream = { pipe: sinon.stub() }
      ctx.ProjectZipStreamManager.createZipStreamForProject = sinon
        .stub()
        .callsArgWith(1, null, ctx.stream)
      ctx.req.params = { Project_id: ctx.project_id }
      ctx.project_name = 'project name with accênts and % special characters'
      ctx.ProjectGetter.getProject = sinon
        .stub()
        .callsArgWith(2, null, { name: ctx.project_name })
      ctx.DocumentUpdaterHandler.flushProjectToMongo = sinon
        .stub()
        .callsArgWith(1)
      ctx.metrics.inc = sinon.stub()
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
        .calledWith(ctx.project_id, { name: true })
        .should.equal(true)
    })

    it('should name the downloaded file after the project but sanitise special characters', function (ctx) {
      ctx.res.headers.should.deep.equal({
        'Content-Disposition': `attachment; filename="project_name_with_accênts_and___special_characters.zip"`,
        'Content-Type': 'application/zip',
        'X-Content-Type-Options': 'nosniff',
      })
    })

    it('should record the action via Metrics', function (ctx) {
      return ctx.metrics.inc.calledWith('zip-downloads').should.equal(true)
    })
  })

  describe('downloadMultipleProjects', function () {
    beforeEach(function (ctx) {
      ctx.stream = { pipe: sinon.stub() }
      ctx.ProjectZipStreamManager.createZipStreamForMultipleProjects = sinon
        .stub()
        .callsArgWith(1, null, ctx.stream)
      ctx.project_ids = ['project-1', 'project-2']
      ctx.req.query = { project_ids: ctx.project_ids.join(',') }
      ctx.DocumentUpdaterHandler.flushMultipleProjectsToMongo = sinon
        .stub()
        .callsArgWith(1)
      ctx.metrics.inc = sinon.stub()
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
        'X-Content-Type-Options': 'nosniff',
      })
    })

    it('should record the action via Metrics', function (ctx) {
      return ctx.metrics.inc
        .calledWith('zip-downloads-multiple')
        .should.equal(true)
    })
  })
})
