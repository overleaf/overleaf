/* eslint-disable
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath =
  '../../../../app/src/Features/Uploads/ProjectUploadController.js'
const SandboxedModule = require('sandboxed-module')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')
const Errors = require('../../../../app/src/Features/Errors/Errors')

describe('ProjectUploadController', function() {
  beforeEach(function() {
    let Timer
    this.req = new MockRequest()
    this.res = new MockResponse()
    this.user_id = 'user-id-123'
    this.metrics = {
      Timer: (Timer = (function() {
        Timer = class Timer {
          static initClass() {
            this.prototype.done = sinon.stub()
          }
        }
        Timer.initClass()
        return Timer
      })())
    }
    this.AuthenticationController = {
      getLoggedInUserId: sinon.stub().returns(this.user_id)
    }

    return (this.ProjectUploadController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './ProjectUploadManager': (this.ProjectUploadManager = {}),
        './FileSystemImportManager': (this.FileSystemImportManager = {}),
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          error: sinon.stub(),
          err() {}
        }),
        'metrics-sharelatex': this.metrics,
        '../Authentication/AuthenticationController': this
          .AuthenticationController,
        fs: (this.fs = {})
      }
    }))
  })

  describe('uploadProject', function() {
    beforeEach(function() {
      this.path = '/path/to/file/on/disk.zip'
      this.name = 'filename.zip'
      this.req.file = {
        path: this.path,
        originalname: this.name
      }
      this.req.session = {
        user: {
          _id: this.user_id
        }
      }
      this.project = { _id: (this.project_id = 'project-id-123') }

      return (this.fs.unlink = sinon.stub())
    })

    describe('successfully', function() {
      beforeEach(function() {
        this.ProjectUploadManager.createProjectFromZipArchive = sinon
          .stub()
          .callsArgWith(3, null, this.project)
        return this.ProjectUploadController.uploadProject(this.req, this.res)
      })

      it('should create a project owned by the logged in user', function() {
        return this.ProjectUploadManager.createProjectFromZipArchive
          .calledWith(this.user_id)
          .should.equal(true)
      })

      it('should create a project with the same name as the zip archive', function() {
        return this.ProjectUploadManager.createProjectFromZipArchive
          .calledWith(sinon.match.any, 'filename', sinon.match.any)
          .should.equal(true)
      })

      it('should create a project from the zip archive', function() {
        return this.ProjectUploadManager.createProjectFromZipArchive
          .calledWith(sinon.match.any, sinon.match.any, this.path)
          .should.equal(true)
      })

      it('should return a successful response to the FileUploader client', function() {
        return expect(this.res.body).to.deep.equal({
          success: true,
          project_id: this.project_id
        })
      })

      it('should record the time taken to do the upload', function() {
        return this.metrics.Timer.prototype.done.called.should.equal(true)
      })

      it('should output a log line', function() {
        return this.logger.log
          .calledWith(sinon.match.any, 'uploaded project')
          .should.equal(true)
      })

      it('should remove the uploaded file', function() {
        return this.fs.unlink.calledWith(this.path).should.equal(true)
      })
    })

    describe('when ProjectUploadManager.createProjectFromZipArchive fails', function() {
      beforeEach(function() {
        this.ProjectUploadManager.createProjectFromZipArchive = sinon
          .stub()
          .callsArgWith(3, new Error('Something went wrong'), this.project)
        return this.ProjectUploadController.uploadProject(this.req, this.res)
      })

      it('should return a failed response to the FileUploader client', function() {
        return expect(this.res.body).to.deep.equal(
          JSON.stringify({ success: false, error: 'upload_failed' })
        )
      })

      it('should output an error log line', function() {
        return this.logger.error
          .calledWith(sinon.match.any, 'error uploading project')
          .should.equal(true)
      })
    })

    describe('when ProjectUploadManager.createProjectFromZipArchive reports the file as invalid', function() {
      beforeEach(function() {
        this.ProjectUploadManager.createProjectFromZipArchive = sinon
          .stub()
          .callsArgWith(
            3,
            new Errors.InvalidError('zip_contents_too_large'),
            this.project
          )
        return this.ProjectUploadController.uploadProject(this.req, this.res)
      })

      it('should return the reported error to the FileUploader client', function() {
        return expect(this.res.body).to.deep.equal(
          JSON.stringify({ success: false, error: 'zip_contents_too_large' })
        )
      })

      it("should return an 'unprocessable entity' status code", function() {
        return expect(this.res.statusCode).to.equal(422)
      })

      it('should output an error log line', function() {
        return this.logger.error
          .calledWith(sinon.match.any, 'error uploading project')
          .should.equal(true)
      })
    })
  })

  describe('uploadFile', function() {
    beforeEach(function() {
      this.project_id = 'project-id-123'
      this.folder_id = 'folder-id-123'
      this.path = '/path/to/file/on/disk.png'
      this.name = 'filename.png'
      this.req.file = {
        path: this.path,
        originalname: this.name
      }
      this.req.session = {
        user: {
          _id: this.user_id
        }
      }
      this.req.params = { Project_id: this.project_id }
      this.req.query = { folder_id: this.folder_id }
      return (this.fs.unlink = sinon.stub())
    })

    describe('successfully', function() {
      beforeEach(function() {
        this.entity = {
          _id: '1234',
          type: 'file'
        }
        this.FileSystemImportManager.addEntity = sinon
          .stub()
          .callsArgWith(6, null, this.entity)
        return this.ProjectUploadController.uploadFile(this.req, this.res)
      })

      it('should insert the file', function() {
        return this.FileSystemImportManager.addEntity
          .calledWith(
            this.user_id,
            this.project_id,
            this.folder_id,
            this.name,
            this.path
          )
          .should.equal(true)
      })

      it('should return a successful response to the FileUploader client', function() {
        return expect(this.res.body).to.deep.equal({
          success: true,
          entity_id: this.entity._id,
          entity_type: 'file'
        })
      })

      it('should output a log line', function() {
        return this.logger.log
          .calledWith(sinon.match.any, 'uploaded file')
          .should.equal(true)
      })

      it('should time the request', function() {
        return this.metrics.Timer.prototype.done.called.should.equal(true)
      })

      it('should remove the uploaded file', function() {
        return this.fs.unlink.calledWith(this.path).should.equal(true)
      })
    })

    describe('when FileSystemImportManager.addEntity returns an error', function() {
      beforeEach(function() {
        this.FileSystemImportManager.addEntity = sinon
          .stub()
          .callsArgWith(6, new Error('Sorry something went wrong'))
        return this.ProjectUploadController.uploadFile(this.req, this.res)
      })

      it('should return an unsuccessful response to the FileUploader client', function() {
        return expect(this.res.body).to.deep.equal({
          success: false
        })
      })

      it('should output an error log line', function() {
        return this.logger.error
          .calledWith(sinon.match.any, 'error uploading file')
          .should.equal(true)
      })
    })

    describe('with a bad request', function() {
      beforeEach(function() {
        this.req.file.originalname = ''
        return this.ProjectUploadController.uploadFile(this.req, this.res)
      })

      it('should return a a non success response', function() {
        return expect(this.res.body).to.deep.equal({
          success: false
        })
      })
    })
  })
})
