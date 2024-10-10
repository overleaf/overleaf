// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import sinon from 'sinon'
import esmock from 'esmock'
import MockRequest from '../helpers/MockRequest.js'
import MockResponse from '../helpers/MockResponse.js'
const modulePath =
  '../../../../app/src/Features/Downloads/ProjectDownloadsController.mjs'

describe('ProjectDownloadsController', function () {
  beforeEach(async function () {
    this.project_id = 'project-id-123'
    this.req = new MockRequest()
    this.res = new MockResponse()
    this.next = sinon.stub()
    this.DocumentUpdaterHandler = sinon.stub()
    return (this.ProjectDownloadsController = await esmock.strict(modulePath, {
      '../../../../app/src/Features/Downloads/ProjectZipStreamManager.mjs':
        (this.ProjectZipStreamManager = {}),
      '../../../../app/src/Features/Project/ProjectGetter.js':
        (this.ProjectGetter = {}),
      '@overleaf/metrics': (this.metrics = {}),
      '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler.js':
        this.DocumentUpdaterHandler,
    }))
  })

  describe('downloadProject', function () {
    beforeEach(function () {
      this.stream = { pipe: sinon.stub() }
      this.ProjectZipStreamManager.createZipStreamForProject = sinon
        .stub()
        .callsArgWith(1, null, this.stream)
      this.req.params = { Project_id: this.project_id }
      this.project_name = 'project name with accênts'
      this.ProjectGetter.getProject = sinon
        .stub()
        .callsArgWith(2, null, { name: this.project_name })
      this.DocumentUpdaterHandler.flushProjectToMongo = sinon
        .stub()
        .callsArgWith(1)
      this.metrics.inc = sinon.stub()
      return this.ProjectDownloadsController.downloadProject(
        this.req,
        this.res,
        this.next
      )
    })

    it('should create a zip from the project', function () {
      return this.ProjectZipStreamManager.createZipStreamForProject
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should stream the zip to the request', function () {
      return this.stream.pipe.calledWith(this.res).should.equal(true)
    })

    it('should set the correct content type on the request', function () {
      return this.res.contentType
        .calledWith('application/zip')
        .should.equal(true)
    })

    it('should flush the project to mongo', function () {
      return this.DocumentUpdaterHandler.flushProjectToMongo
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it("should look up the project's name", function () {
      return this.ProjectGetter.getProject
        .calledWith(this.project_id, { name: true })
        .should.equal(true)
    })

    it('should name the downloaded file after the project', function () {
      this.res.headers.should.deep.equal({
        'Content-Disposition': `attachment; filename="${this.project_name}.zip"`,
        'Content-Type': 'application/zip',
        'X-Content-Type-Options': 'nosniff',
      })
    })

    it('should record the action via Metrics', function () {
      return this.metrics.inc.calledWith('zip-downloads').should.equal(true)
    })
  })

  describe('downloadMultipleProjects', function () {
    beforeEach(function () {
      this.stream = { pipe: sinon.stub() }
      this.ProjectZipStreamManager.createZipStreamForMultipleProjects = sinon
        .stub()
        .callsArgWith(1, null, this.stream)
      this.project_ids = ['project-1', 'project-2']
      this.req.query = { project_ids: this.project_ids.join(',') }
      this.DocumentUpdaterHandler.flushMultipleProjectsToMongo = sinon
        .stub()
        .callsArgWith(1)
      this.metrics.inc = sinon.stub()
      return this.ProjectDownloadsController.downloadMultipleProjects(
        this.req,
        this.res,
        this.next
      )
    })

    it('should create a zip from the project', function () {
      return this.ProjectZipStreamManager.createZipStreamForMultipleProjects
        .calledWith(this.project_ids)
        .should.equal(true)
    })

    it('should stream the zip to the request', function () {
      return this.stream.pipe.calledWith(this.res).should.equal(true)
    })

    it('should set the correct content type on the request', function () {
      return this.res.contentType
        .calledWith('application/zip')
        .should.equal(true)
    })

    it('should flush the projects to mongo', function () {
      return this.DocumentUpdaterHandler.flushMultipleProjectsToMongo
        .calledWith(this.project_ids)
        .should.equal(true)
    })

    it('should name the downloaded file after the project', function () {
      this.res.headers.should.deep.equal({
        'Content-Disposition':
          'attachment; filename="Overleaf Projects (2 items).zip"',
        'Content-Type': 'application/zip',
        'X-Content-Type-Options': 'nosniff',
      })
    })

    it('should record the action via Metrics', function () {
      return this.metrics.inc
        .calledWith('zip-downloads-multiple')
        .should.equal(true)
    })
  })
})
