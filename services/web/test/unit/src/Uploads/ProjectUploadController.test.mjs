// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { expect, vi } from 'vitest'
import sinon from 'sinon'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'
import ArchiveErrors from '../../../../app/src/Features/Uploads/ArchiveErrors.mjs'
import { FileTooLargeError } from '../../../../app/src/Features/Errors/Errors.js'

const modulePath =
  '../../../../app/src/Features/Uploads/ProjectUploadController.mjs'

describe('ProjectUploadController', function () {
  beforeEach(async function (ctx) {
    let Timer
    ctx.req = new MockRequest(vi)
    ctx.res = new MockResponse(vi)
    ctx.user_id = 'user-id-123'
    ctx.metrics = {
      Timer: (Timer = (function () {
        Timer = class Timer {
          static initClass() {
            this.prototype.done = sinon.stub()
          }
        }
        Timer.initClass()
        return Timer
      })()),
    }
    ctx.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(ctx.user_id),
    }
    ctx.ProjectLocator = {
      promises: {},
    }
    ctx.EditorController = {
      promises: {},
    }
    ctx.DocumentConversionManager = {
      promises: {
        convertDocxToLaTeXZipArchive: sinon.stub(),
      },
    }

    vi.doMock('multer', () => ({
      default: sinon.stub(),
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: { path: {} },
    }))

    vi.doMock(
      '../../../../app/src/Features/Uploads/ProjectUploadManager',
      () => ({
        default: (ctx.ProjectUploadManager = { promises: {} }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Uploads/FileSystemImportManager',
      () => ({
        default: (ctx.FileSystemImportManager = {}),
      })
    )

    vi.doMock('@overleaf/metrics', () => ({
      default: ctx.metrics,
    }))

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: ctx.SessionManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Uploads/ArchiveErrors',
      () => ArchiveErrors
    )

    vi.doMock('../../../../app/src/Features/Project/ProjectLocator', () => ({
      default: ctx.ProjectLocator,
    }))

    vi.doMock('../../../../app/src/Features/Editor/EditorController', () => ({
      default: ctx.EditorController,
    }))

    vi.doMock(
      '../../../../app/src/Features/Uploads/DocumentConversionManager.mjs',
      () => ({
        default: ctx.DocumentConversionManager,
      })
    )

    vi.doMock('fs', () => ({
      default: (ctx.fs = {}),
    }))

    vi.doMock('node:fs/promises', () => ({
      default: (ctx.fsPromises = {}),
    }))

    ctx.ProjectUploadController = (await import(modulePath)).default
  })

  describe('uploadProject', function () {
    beforeEach(function (ctx) {
      ctx.path = '/path/to/file/on/disk.zip'
      ctx.fileName = 'filename.zip'
      ctx.req.file = {
        path: ctx.path,
      }
      ctx.req.body = {
        name: ctx.fileName,
      }
      ctx.req.session = {
        user: {
          _id: ctx.user_id,
        },
      }
      ctx.project = { _id: (ctx.project_id = 'project-id-123') }

      ctx.fs.unlink = sinon.stub()
    })

    describe('successfully', function () {
      beforeEach(function (ctx) {
        ctx.ProjectUploadManager.createProjectFromZipArchive = sinon
          .stub()
          .callsArgWith(3, null, ctx.project)
        ctx.ProjectUploadController.uploadProject(ctx.req, ctx.res)
      })

      it('should create a project owned by the logged in user', function (ctx) {
        ctx.ProjectUploadManager.createProjectFromZipArchive
          .calledWith(ctx.user_id)
          .should.equal(true)
      })

      it('should create a project with the same name as the zip archive', function (ctx) {
        ctx.ProjectUploadManager.createProjectFromZipArchive
          .calledWith(sinon.match.any, 'filename', sinon.match.any)
          .should.equal(true)
      })

      it('should create a project from the zip archive', function (ctx) {
        ctx.ProjectUploadManager.createProjectFromZipArchive
          .calledWith(sinon.match.any, sinon.match.any, ctx.path)
          .should.equal(true)
      })

      it('should return a successful response to the FileUploader client', function (ctx) {
        expect(ctx.res.body).to.deep.equal(
          JSON.stringify({
            success: true,
            project_id: ctx.project_id,
          })
        )
      })

      it('should record the time taken to do the upload', function (ctx) {
        ctx.metrics.Timer.prototype.done.called.should.equal(true)
      })

      it('should remove the uploaded file', function (ctx) {
        ctx.fs.unlink.calledWith(ctx.path).should.equal(true)
      })
    })

    describe('when ProjectUploadManager.createProjectFromZipArchive fails', function () {
      beforeEach(function (ctx) {
        ctx.ProjectUploadManager.createProjectFromZipArchive = sinon
          .stub()
          .callsArgWith(3, new Error('Something went wrong'), ctx.project)
        ctx.ProjectUploadController.uploadProject(ctx.req, ctx.res)
      })

      it('should return a failed response to the FileUploader client', function (ctx) {
        expect(ctx.res.body).to.deep.equal(
          JSON.stringify({ success: false, error: 'upload_failed' })
        )
      })
    })

    describe('when ProjectUploadManager.createProjectFromZipArchive reports the file as invalid', function () {
      beforeEach(function (ctx) {
        ctx.ProjectUploadManager.createProjectFromZipArchive = sinon
          .stub()
          .callsArgWith(
            3,
            new ArchiveErrors.ZipContentsTooLargeError(),
            ctx.project
          )
        ctx.ProjectUploadController.uploadProject(ctx.req, ctx.res)
      })

      it('should return the reported error to the FileUploader client', function (ctx) {
        expect(JSON.parse(ctx.res.body)).to.deep.equal({
          success: false,
          error: 'zip_contents_too_large',
        })
      })

      it("should return an 'unprocessable entity' status code", function (ctx) {
        expect(ctx.res.statusCode).to.equal(422)
      })
    })
  })

  describe('uploadFile', function () {
    beforeEach(function (ctx) {
      ctx.project_id = 'project-id-123'
      ctx.folder_id = 'folder-id-123'
      ctx.path = '/path/to/file/on/disk.png'
      ctx.fileName = 'filename.png'
      ctx.req.file = {
        path: ctx.path,
      }
      ctx.req.body = {
        name: ctx.fileName,
      }
      ctx.req.session = {
        user: {
          _id: ctx.user_id,
        },
      }
      ctx.req.params = { Project_id: ctx.project_id }
      ctx.req.query = { folder_id: ctx.folder_id }
      ctx.fs.unlink = sinon.stub()
    })

    describe('successfully', function () {
      beforeEach(function (ctx) {
        ctx.entity = {
          _id: '1234',
          type: 'file',
        }
        ctx.FileSystemImportManager.addEntity = sinon
          .stub()
          .callsArgWith(6, null, ctx.entity)
        ctx.ProjectUploadController.uploadFile(ctx.req, ctx.res)
      })

      it('should insert the file', function (ctx) {
        return ctx.FileSystemImportManager.addEntity
          .calledWith(
            ctx.user_id,
            ctx.project_id,
            ctx.folder_id,
            ctx.fileName,
            ctx.path
          )
          .should.equal(true)
      })

      it('should return a successful response to the FileUploader client', function (ctx) {
        expect(ctx.res.body).to.deep.equal(
          JSON.stringify({
            success: true,
            entity_id: ctx.entity._id,
            entity_type: 'file',
          })
        )
      })

      it('should time the request', function (ctx) {
        ctx.metrics.Timer.prototype.done.called.should.equal(true)
      })

      it('should remove the uploaded file', function (ctx) {
        ctx.fs.unlink.calledWith(ctx.path).should.equal(true)
      })
    })

    describe('with folder structure', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.entity = {
            _id: '1234',
            type: 'file',
          }
          ctx.FileSystemImportManager.addEntity = sinon
            .stub()
            .callsArgWith(6, null, ctx.entity)
          ctx.ProjectLocator.promises.findElement = sinon.stub().resolves({
            path: { fileSystem: '/test' },
          })
          ctx.EditorController.promises.mkdirp = sinon.stub().resolves({
            lastFolder: { _id: 'folder-id' },
          })
          ctx.req.body.relativePath = 'foo/bar/' + ctx.fileName
          ctx.res.json = data => {
            expect(data.success).to.be.true
            resolve()
          }
          ctx.ProjectUploadController.uploadFile(ctx.req, ctx.res)
        })
      })

      it('should insert the file', function (ctx) {
        ctx.ProjectLocator.promises.findElement.should.be.calledOnceWithExactly(
          {
            project_id: ctx.project_id,
            element_id: ctx.folder_id,
            type: 'folder',
          }
        )

        ctx.EditorController.promises.mkdirp.should.be.calledWith(
          ctx.project_id,
          '/test/foo/bar',
          ctx.user_id
        )

        ctx.FileSystemImportManager.addEntity.should.be.calledOnceWith(
          ctx.user_id,
          ctx.project_id,
          'folder-id',
          ctx.fileName,
          ctx.path
        )
      })
    })

    describe('when looking up the folder structure fails', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.error = new Error('woops')
          ctx.ProjectLocator.promises.findElement = sinon
            .stub()
            .rejects(ctx.error)
          ctx.req.body.relativePath = 'foo/bar/' + ctx.fileName

          ctx.next = error => {
            ctx.nextError = error
            resolve()
          }

          ctx.ProjectUploadController.uploadFile(ctx.req, ctx.res, ctx.next)
        })
      })

      it('should unlink the file', function (ctx) {
        ctx.fs.unlink.should.have.been.calledWith(ctx.path)
      })

      it('should call next with the error', function (ctx) {
        expect(ctx.nextError).to.equal(ctx.error)
      })
    })

    describe('when FileSystemImportManager.addEntity returns a generic error', function () {
      beforeEach(function (ctx) {
        ctx.FileSystemImportManager.addEntity = sinon
          .stub()
          .callsArgWith(6, new Error('Sorry something went wrong'))
        ctx.ProjectUploadController.uploadFile(ctx.req, ctx.res)
      })

      it('should return an unsuccessful response to the FileUploader client', function (ctx) {
        expect(ctx.res.body).to.deep.equal(
          JSON.stringify({
            success: false,
          })
        )
      })
    })

    describe('when FileSystemImportManager.addEntity returns a too many files error', function () {
      beforeEach(function (ctx) {
        ctx.FileSystemImportManager.addEntity = sinon
          .stub()
          .callsArgWith(6, new Error('project_has_too_many_files'))
        ctx.ProjectUploadController.uploadFile(ctx.req, ctx.res)
      })

      it('should return an unsuccessful response to the FileUploader client', function (ctx) {
        expect(ctx.res.body).to.deep.equal(
          JSON.stringify({
            success: false,
            error: 'project_has_too_many_files',
          })
        )
      })
    })

    describe('with an invalid filename', function () {
      beforeEach(function (ctx) {
        ctx.req.body.name = ''
        ctx.ProjectUploadController.uploadFile(ctx.req, ctx.res)
      })

      it('should return a non success response', function (ctx) {
        expect(ctx.res.body).to.deep.equal(
          JSON.stringify({
            success: false,
            error: 'invalid_filename',
          })
        )
      })

      it('should remove the uploaded file', function (ctx) {
        ctx.fs.unlink.calledWith(ctx.path).should.equal(true)
      })
    })

    describe('with a filename that is too long', function () {
      beforeEach(function (ctx) {
        ctx.req.body.name = 'a'.repeat(151)
        ctx.ProjectUploadController.uploadFile(ctx.req, ctx.res)
      })

      it('should return a non success response', function (ctx) {
        expect(ctx.res.body).to.deep.equal(
          JSON.stringify({
            success: false,
            error: 'invalid_filename',
          })
        )
      })

      it('should remove the uploaded file', function (ctx) {
        ctx.fs.unlink.calledWith(ctx.path).should.equal(true)
      })
    })
  })

  describe('importDocx', function () {
    beforeEach(async function (ctx) {
      ctx.req.file = {
        path: '/path/to/uploaded/file.docx',
      }
      ctx.req.body = {
        name: 'file.docx',
      }
      ctx.archivePath = '/path/to/archive.zip'
      ctx.fsPromises.unlink = sinon.stub().resolves()
    })

    describe('successfully', async function () {
      beforeEach(async function (ctx) {
        ctx.DocumentConversionManager.promises.convertDocxToLaTeXZipArchive =
          sinon.stub().resolves(ctx.archivePath)
        ctx.ProjectUploadManager.promises.createProjectFromZipArchive = sinon
          .stub()
          .resolves({
            _id: 'new-project-id',
          })

        await new Promise(resolve => {
          ctx.res.json = data => {
            expect(data.success).to.be.true
            expect(data.project_id).to.equal('new-project-id')
            resolve()
          }
          ctx.ProjectUploadController.importDocx(ctx.req, ctx.res)
        })
      })

      it('should call the DocumentConversionManager to convert the file', function (ctx) {
        expect(
          ctx.DocumentConversionManager.promises.convertDocxToLaTeXZipArchive
        ).to.have.been.calledWith(ctx.req.file.path, ctx.user_id)
      })

      it('should use the resulting archive to create a new project', function (ctx) {
        expect(
          ctx.ProjectUploadManager.promises.createProjectFromZipArchive
        ).to.have.been.calledWith(ctx.user_id, 'file', ctx.archivePath)
      })

      it('should unlink the archive after creating the project', function (ctx) {
        expect(ctx.fsPromises.unlink).to.have.been.calledWith(ctx.archivePath)
      })

      it('should unlink the uploaded file', function (ctx) {
        expect(ctx.fsPromises.unlink).to.have.been.calledWith(ctx.req.file.path)
      })
    })

    describe('unsuccessfully', async function () {
      beforeEach(async function (ctx) {
        ctx.DocumentConversionManager.promises.convertDocxToLaTeXZipArchive =
          sinon.stub().rejects(new Error('Conversion failed'))

        await new Promise(resolve => {
          ctx.res.json = data => {
            expect(data.success).to.be.false
            resolve()
          }
          ctx.ProjectUploadController.importDocx(ctx.req, ctx.res)
        })
      })

      it('should call the DocumentConversionManager to convert the file', function (ctx) {
        expect(
          ctx.DocumentConversionManager.promises.convertDocxToLaTeXZipArchive
        ).to.have.been.calledWith(ctx.req.file.path, ctx.user_id)
      })

      it('should unlink the uploaded file', function (ctx) {
        expect(ctx.fsPromises.unlink).to.have.been.calledWith(ctx.req.file.path)
      })

      it('should return http 500', function (ctx) {
        expect(ctx.res.statusCode).to.equal(500)
      })
    })

    describe('when the converted archive is too large', async function () {
      beforeEach(async function (ctx) {
        ctx.DocumentConversionManager.promises.convertDocxToLaTeXZipArchive =
          sinon.stub().rejects(new FileTooLargeError('file too large'))

        await new Promise(resolve => {
          ctx.res.json = data => {
            expect(data).to.deep.equal({
              success: false,
              error: 'file_too_large',
            })
            resolve()
          }
          ctx.ProjectUploadController.importDocx(ctx.req, ctx.res)
        })
      })

      it('should return http 422', function (ctx) {
        expect(ctx.res.statusCode).to.equal(422)
      })

      it('should unlink the uploaded file', function (ctx) {
        expect(ctx.fsPromises.unlink).to.have.been.calledWith(ctx.req.file.path)
      })
    })
  })
})
