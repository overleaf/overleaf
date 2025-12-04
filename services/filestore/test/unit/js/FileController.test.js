import sinon from 'sinon'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Errors from '../../../app/js/Errors.js'

const modulePath = '../../../app/js/FileController.js'

describe('FileController', () => {
  let FileHandler, LocalFileWriter, FileController, req, res, next, stream
  const settings = {
    s3: {
      buckets: {
        template_files: 'template_files',
      },
    },
  }
  const fileSize = 1234
  const fileStream = {
    destroy() {},
  }
  const projectId = 'projectId'
  const fileId = 'file_id'
  const bucket = 'template_files'
  const key = `${projectId}/${fileId}`
  const error = new Error('incorrect utensil')

  beforeEach(async () => {
    FileHandler = {
      getFile: sinon.stub().yields(null, fileStream),
      getFileSize: sinon.stub().yields(null, fileSize),
      insertFile: sinon.stub().yields(),
      getRedirectUrl: sinon.stub().yields(null, null),
    }

    LocalFileWriter = {}
    stream = {
      pipeline: sinon.stub(),
    }

    vi.doMock('../../../app/js/LocalFileWriter', () => ({
      default: LocalFileWriter,
    }))

    vi.doMock('../../../app/js/FileHandler', () => ({
      default: FileHandler,
    }))

    vi.doMock('../../../app/js/Errors', () => ({
      default: Errors,
    }))

    vi.doMock('stream', () => stream)

    vi.doMock('@overleaf/settings', () => ({
      default: settings,
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: {
        inc() {},
      },
    }))

    FileController = (await import(modulePath)).default

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

  describe('getFile', () => {
    it('should try and get a redirect url first', () => {
      FileController.getFile(req, res, next)
      expect(FileHandler.getRedirectUrl).to.have.been.calledWith(bucket, key)
    })

    it('should pipe the stream', () => {
      FileController.getFile(req, res, next)
      expect(stream.pipeline).to.have.been.calledWith(fileStream, res)
    })

    it('should send a 200 if the cacheWarm param is true', async () => {
      req.query.cacheWarm = true
      await new Promise(resolve => {
        res.sendStatus = statusCode => {
          expect(statusCode).to.equal(200)
          resolve()
        }
        FileController.getFile(req, res, next)
      })
    })

    it('should send an error if there is a problem', () => {
      FileHandler.getFile.yields(error)
      FileController.getFile(req, res, next)
      expect(next).to.have.been.calledWith(error)
    })

    describe('with a redirect url', () => {
      const redirectUrl = 'https://wombat.potato/giraffe'

      beforeEach(() => {
        FileHandler.getRedirectUrl.yields(null, redirectUrl)
        res.redirect = sinon.stub()
      })

      it('should redirect', () => {
        FileController.getFile(req, res, next)
        expect(res.redirect).to.have.been.calledWith(redirectUrl)
      })

      it('should not get a file stream', () => {
        FileController.getFile(req, res, next)
        expect(FileHandler.getFile).not.to.have.been.called
      })

      describe('when there is an error getting the redirect url', () => {
        beforeEach(() => {
          FileHandler.getRedirectUrl.yields(new Error('wombat herding error'))
        })

        it('should not redirect', () => {
          FileController.getFile(req, res, next)
          expect(res.redirect).not.to.have.been.called
        })

        it('should not return an error', () => {
          FileController.getFile(req, res, next)
          expect(next).not.to.have.been.called
        })

        it('should proxy the file', () => {
          FileController.getFile(req, res, next)
          expect(FileHandler.getFile).to.have.been.calledWith(bucket, key)
        })
      })
    })

    describe('with a range header', () => {
      let expectedOptions

      beforeEach(() => {
        expectedOptions = {
          bucket,
          key,
          format: undefined,
          style: undefined,
        }
      })

      it('should pass range options to FileHandler', () => {
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

      it('should ignore an invalid range header', () => {
        req.headers.range = 'potato'
        FileController.getFile(req, res, next)
        expect(FileHandler.getFile).to.have.been.calledWith(
          bucket,
          key,
          expectedOptions
        )
      })

      it("should ignore any type other than 'bytes'", () => {
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

  describe('getFileHead', () => {
    it('should return the file size in a Content-Length header', async () => {
      await new Promise(resolve => {
        res.end = () => {
          expect(res.status).to.have.been.calledWith(200)
          expect(res.set).to.have.been.calledWith('Content-Length', fileSize)
          resolve()
        }

        FileController.getFileHead(req, res, next)
      })
    })

    it('should return a 404 is the file is not found', async () => {
      await new Promise(resolve => {
        FileHandler.getFileSize.yields(
          new Errors.NotFoundError({ message: 'not found', info: {} })
        )

        res.sendStatus = code => {
          expect(code).to.equal(404)
          resolve()
        }

        FileController.getFileHead(req, res, next)
      })
    })

    it('should send an error on internal errors', () => {
      FileHandler.getFileSize.yields(error)

      FileController.getFileHead(req, res, next)
      expect(next).to.have.been.calledWith(error)
    })
  })

  describe('insertFile', () => {
    it('should send bucket name key and res to FileHandler', async () => {
      await new Promise(resolve => {
        res.sendStatus = code => {
          expect(FileHandler.insertFile).to.have.been.calledWith(
            bucket,
            key,
            req
          )
          expect(code).to.equal(200)
          resolve()
        }
        FileController.insertFile(req, res, next)
      })
    })
  })
})
