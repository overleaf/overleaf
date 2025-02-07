import { expect } from 'chai'
import sinon from 'sinon'
import esmock from 'esmock'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import MockResponse from '../helpers/MockResponse.js'

const MODULE_PATH =
  '../../../../app/src/Features/FileStore/FileStoreController.mjs'

const expectedFileHeaders = {
  'Cache-Control': 'private, max-age=3600',
  'X-Served-By': 'filestore',
}

describe('FileStoreController', function () {
  beforeEach(async function () {
    this.FileStoreHandler = {
      promises: {
        getFileStream: sinon.stub(),
        getFileSize: sinon.stub(),
      },
    }
    this.ProjectLocator = { promises: { findElement: sinon.stub() } }
    this.Stream = { pipeline: sinon.stub().resolves() }
    this.HistoryManager = {}
    this.controller = await esmock.strict(MODULE_PATH, {
      'node:stream/promises': this.Stream,
      '@overleaf/settings': this.settings,
      '../../../../app/src/Features/Project/ProjectLocator':
        this.ProjectLocator,
      '../../../../app/src/Features/FileStore/FileStoreHandler':
        this.FileStoreHandler,
      '../../../../app/src/Features/History/HistoryManager':
        this.HistoryManager,
    })
    this.stream = {}
    this.projectId = '2k3j1lk3j21lk3j'
    this.fileId = '12321kklj1lk3jk12'
    this.req = {
      params: {
        Project_id: this.projectId,
        File_id: this.fileId,
      },
      query: 'query string here',
      get(key) {
        return undefined
      },
      logger: {
        addFields: sinon.stub(),
      },
    }
    this.res = new MockResponse()
    this.next = sinon.stub()
    this.file = { name: 'myfile.png' }
  })

  describe('getFile', function () {
    beforeEach(function () {
      this.FileStoreHandler.promises.getFileStream.resolves(this.stream)
      this.ProjectLocator.promises.findElement.resolves({ element: this.file })
    })

    it('should call the file store handler with the project_id file_id and any query string', async function () {
      await this.controller.getFile(this.req, this.res)
      this.FileStoreHandler.promises.getFileStream.should.have.been.calledWith(
        this.req.params.Project_id,
        this.req.params.File_id,
        this.req.query
      )
    })

    it('should pipe to res', async function () {
      await this.controller.getFile(this.req, this.res)
      this.Stream.pipeline.should.have.been.calledWith(this.stream, this.res)
    })

    it('should get the file from the db', async function () {
      await this.controller.getFile(this.req, this.res)
      this.ProjectLocator.promises.findElement.should.have.been.calledWith({
        project_id: this.projectId,
        element_id: this.fileId,
        type: 'file',
      })
    })

    it('should set the Content-Disposition header', async function () {
      await this.controller.getFile(this.req, this.res)
      this.res.setContentDisposition.should.be.calledWith('attachment', {
        filename: this.file.name,
      })
    })

    it('should return a 404 when not found', async function () {
      this.ProjectLocator.promises.findElement.rejects(
        new Errors.NotFoundError()
      )
      await this.controller.getFile(this.req, this.res)
      expect(this.res.statusCode).to.equal(404)
    })

    // Test behaviour around handling html files
    ;['.html', '.htm', '.xhtml'].forEach(extension => {
      describe(`with a '${extension}' file extension`, function () {
        beforeEach(function () {
          this.file.name = `bad${extension}`
          this.req.get = key => {
            if (key === 'User-Agent') {
              return 'A generic browser'
            }
          }
        })

        describe('from a non-ios browser', function () {
          it('should not set Content-Type', async function () {
            await this.controller.getFile(this.req, this.res)
            this.res.headers.should.deep.equal({
              ...expectedFileHeaders,
            })
          })
        })

        describe('from an iPhone', function () {
          beforeEach(function () {
            this.req.get = key => {
              if (key === 'User-Agent') {
                return 'An iPhone browser'
              }
            }
          })

          it("should set Content-Type to 'text/plain'", async function () {
            await this.controller.getFile(this.req, this.res)
            this.res.headers.should.deep.equal({
              ...expectedFileHeaders,
              'Content-Type': 'text/plain; charset=utf-8',
              'X-Content-Type-Options': 'nosniff',
            })
          })
        })

        describe('from an iPad', function () {
          beforeEach(function () {
            this.req.get = key => {
              if (key === 'User-Agent') {
                return 'An iPad browser'
              }
            }
          })

          it("should set Content-Type to 'text/plain'", async function () {
            await this.controller.getFile(this.req, this.res)
            this.res.headers.should.deep.equal({
              ...expectedFileHeaders,
              'Content-Type': 'text/plain; charset=utf-8',
              'X-Content-Type-Options': 'nosniff',
            })
          })
        })
      })
    })
    ;[
      // None of these should trigger the iOS/html logic
      'x.html-is-rad',
      'html.pdf',
      '.html-is-good-for-hidden-files',
      'somefile',
    ].forEach(filename => {
      describe(`with filename as '${filename}'`, function () {
        beforeEach(function () {
          this.user_agent = 'A generic browser'
          this.file.name = filename
          this.req.get = key => {
            if (key === 'User-Agent') {
              return this.user_agent
            }
          }
        })
        ;['iPhone', 'iPad', 'Firefox', 'Chrome'].forEach(browser => {
          describe(`downloaded from ${browser}`, function () {
            beforeEach(function () {
              this.user_agent = `Some ${browser} thing`
            })

            it('Should not set the Content-type', async function () {
              await this.controller.getFile(this.req, this.res)
              this.res.headers.should.deep.equal({
                ...expectedFileHeaders,
              })
            })
          })
        })
      })
    })
  })

  describe('getFileHead', function () {
    beforeEach(function () {
      this.ProjectLocator.promises.findElement.resolves({ element: this.file })
    })

    it('reports the file size', function (done) {
      const expectedFileSize = 99393
      this.FileStoreHandler.promises.getFileSize.rejects(
        new Error('getFileSize: unexpected arguments')
      )
      this.FileStoreHandler.promises.getFileSize
        .withArgs(this.projectId, this.fileId)
        .resolves(expectedFileSize)

      this.res.end = () => {
        expect(this.res.status.lastCall.args).to.deep.equal([200])
        expect(this.res.header.lastCall.args).to.deep.equal([
          'Content-Length',
          expectedFileSize,
        ])
        done()
      }

      this.controller.getFileHead(this.req, this.res)
    })

    it('returns 404 on NotFoundError', function (done) {
      this.FileStoreHandler.promises.getFileSize.rejects(
        new Errors.NotFoundError()
      )

      this.res.end = () => {
        expect(this.res.status.lastCall.args).to.deep.equal([404])
        done()
      }

      this.controller.getFileHead(this.req, this.res)
    })
  })
})
