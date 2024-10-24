const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../app/js/Errors')
const modulePath = '../../../app/js/FileController.js'

describe('FileController', function () {
  let FileHandler, LocalFileWriter, FileController, req, res, next, stream
  const settings = {
    s3: {
      buckets: {
        user_files: 'user_files',
      },
    },
  }
  const fileSize = 1234
  const fileStream = {
    destroy() {},
  }
  const projectId = 'projectId'
  const fileId = 'file_id'
  const bucket = 'user_files'
  const key = `${projectId}/${fileId}`
  const error = new Error('incorrect utensil')

  beforeEach(function () {
    FileHandler = {
      copyObject: sinon.stub().yields(),
      getFile: sinon.stub().yields(null, fileStream),
      getFileSize: sinon.stub().yields(null, fileSize),
      deleteFile: sinon.stub().yields(),
      deleteProject: sinon.stub().yields(),
      insertFile: sinon.stub().yields(),
      getDirectorySize: sinon.stub().yields(null, fileSize),
      getRedirectUrl: sinon.stub().yields(null, null),
    }

    LocalFileWriter = {}
    stream = {
      pipeline: sinon.stub(),
    }

    FileController = SandboxedModule.require(modulePath, {
      requires: {
        './LocalFileWriter': LocalFileWriter,
        './FileHandler': FileHandler,
        './Errors': Errors,
        stream,
        '@overleaf/settings': settings,
        '@overleaf/metrics': {
          inc() {},
        },
      },
      globals: { console },
    })

    req = {
      key,
      bucket,
      project_id: projectId,
      query: {},
      params: {
        project_id: projectId,
        file_id: fileId,
      },
      headers: {},
      requestLogger: {
        setMessage: sinon.stub(),
        addFields: sinon.stub(),
      },
    }

    res = {
      set: sinon.stub().returnsThis(),
      sendStatus: sinon.stub().returnsThis(),
      status: sinon.stub().returnsThis(),
    }

    next = sinon.stub()
  })

  describe('getFile', function () {
    it('should try and get a redirect url first', function () {
      FileController.getFile(req, res, next)
      expect(FileHandler.getRedirectUrl).to.have.been.calledWith(bucket, key)
    })

    it('should pipe the stream', function () {
      FileController.getFile(req, res, next)
      expect(stream.pipeline).to.have.been.calledWith(fileStream, res)
    })

    it('should send a 200 if the cacheWarm param is true', function (done) {
      req.query.cacheWarm = true
      res.sendStatus = statusCode => {
        statusCode.should.equal(200)
        done()
      }
      FileController.getFile(req, res, next)
    })

    it('should send an error if there is a problem', function () {
      FileHandler.getFile.yields(error)
      FileController.getFile(req, res, next)
      expect(next).to.have.been.calledWith(error)
    })

    describe('with a redirect url', function () {
      const redirectUrl = 'https://wombat.potato/giraffe'

      beforeEach(function () {
        FileHandler.getRedirectUrl.yields(null, redirectUrl)
        res.redirect = sinon.stub()
      })

      it('should redirect', function () {
        FileController.getFile(req, res, next)
        expect(res.redirect).to.have.been.calledWith(redirectUrl)
      })

      it('should not get a file stream', function () {
        FileController.getFile(req, res, next)
        expect(FileHandler.getFile).not.to.have.been.called
      })

      describe('when there is an error getting the redirect url', function () {
        beforeEach(function () {
          FileHandler.getRedirectUrl.yields(new Error('wombat herding error'))
        })

        it('should not redirect', function () {
          FileController.getFile(req, res, next)
          expect(res.redirect).not.to.have.been.called
        })

        it('should not return an error', function () {
          FileController.getFile(req, res, next)
          expect(next).not.to.have.been.called
        })

        it('should proxy the file', function () {
          FileController.getFile(req, res, next)
          expect(FileHandler.getFile).to.have.been.calledWith(bucket, key)
        })
      })
    })

    describe('with a range header', function () {
      let expectedOptions

      beforeEach(function () {
        expectedOptions = {
          bucket,
          key,
          format: undefined,
          style: undefined,
        }
      })

      it('should pass range options to FileHandler', function () {
        req.headers.range = 'bytes=0-8'
        expectedOptions.start = 0
        expectedOptions.end = 8

        FileController.getFile(req, res, next)
        expect(FileHandler.getFile).to.have.been.calledWith(
          bucket,
          key,
          expectedOptions
        )
      })

      it('should ignore an invalid range header', function () {
        req.headers.range = 'potato'
        FileController.getFile(req, res, next)
        expect(FileHandler.getFile).to.have.been.calledWith(
          bucket,
          key,
          expectedOptions
        )
      })

      it("should ignore any type other than 'bytes'", function () {
        req.headers.range = 'wombats=0-8'
        FileController.getFile(req, res, next)
        expect(FileHandler.getFile).to.have.been.calledWith(
          bucket,
          key,
          expectedOptions
        )
      })
    })
  })

  describe('getFileHead', function () {
    it('should return the file size in a Content-Length header', function (done) {
      res.end = () => {
        expect(res.status).to.have.been.calledWith(200)
        expect(res.set).to.have.been.calledWith('Content-Length', fileSize)
        done()
      }

      FileController.getFileHead(req, res, next)
    })

    it('should return a 404 is the file is not found', function (done) {
      FileHandler.getFileSize.yields(
        new Errors.NotFoundError({ message: 'not found', info: {} })
      )

      res.sendStatus = code => {
        expect(code).to.equal(404)
        done()
      }

      FileController.getFileHead(req, res, next)
    })

    it('should send an error on internal errors', function () {
      FileHandler.getFileSize.yields(error)

      FileController.getFileHead(req, res, next)
      expect(next).to.have.been.calledWith(error)
    })
  })

  describe('insertFile', function () {
    it('should send bucket name key and res to FileHandler', function (done) {
      res.sendStatus = code => {
        expect(FileHandler.insertFile).to.have.been.calledWith(bucket, key, req)
        expect(code).to.equal(200)
        done()
      }
      FileController.insertFile(req, res, next)
    })
  })

  describe('copyFile', function () {
    const oldFileId = 'oldFileId'
    const oldProjectId = 'oldProjectid'
    const oldKey = `${oldProjectId}/${oldFileId}`

    beforeEach(function () {
      req.body = {
        source: {
          project_id: oldProjectId,
          file_id: oldFileId,
        },
      }
    })

    it('should send bucket name and both keys to FileHandler', function (done) {
      res.sendStatus = code => {
        code.should.equal(200)
        expect(FileHandler.copyObject).to.have.been.calledWith(
          bucket,
          oldKey,
          key
        )
        done()
      }
      FileController.copyFile(req, res, next)
    })

    it('should send a 404 if the original file was not found', function (done) {
      FileHandler.copyObject.yields(
        new Errors.NotFoundError({ message: 'not found', info: {} })
      )
      res.sendStatus = code => {
        code.should.equal(404)
        done()
      }
      FileController.copyFile(req, res, next)
    })

    it('should send an error if there was an error', function (done) {
      FileHandler.copyObject.yields(error)
      FileController.copyFile(req, res, err => {
        expect(err).to.equal(error)
        done()
      })
    })
  })

  describe('delete file', function () {
    it('should tell the file handler', function (done) {
      res.sendStatus = code => {
        code.should.equal(204)
        expect(FileHandler.deleteFile).to.have.been.calledWith(bucket, key)
        done()
      }
      FileController.deleteFile(req, res, next)
    })

    it('should send a 500 if there was an error', function () {
      FileHandler.deleteFile.yields(error)
      FileController.deleteFile(req, res, next)
      expect(next).to.have.been.calledWith(error)
    })
  })

  describe('delete project', function () {
    it('should tell the file handler', function (done) {
      res.sendStatus = code => {
        code.should.equal(204)
        expect(FileHandler.deleteProject).to.have.been.calledWith(bucket, key)
        done()
      }
      FileController.deleteProject(req, res, next)
    })

    it('should send a 500 if there was an error', function () {
      FileHandler.deleteProject.yields(error)
      FileController.deleteProject(req, res, next)
      expect(next).to.have.been.calledWith(error)
    })
  })

  describe('directorySize', function () {
    it('should return total directory size bytes', function (done) {
      FileController.directorySize(req, {
        json: result => {
          expect(result['total bytes']).to.equal(fileSize)
          done()
        },
      })
    })

    it('should send a 500 if there was an error', function () {
      FileHandler.getDirectorySize.yields(error)
      FileController.directorySize(req, res, next)
      expect(next).to.have.been.calledWith(error)
    })
  })
})
