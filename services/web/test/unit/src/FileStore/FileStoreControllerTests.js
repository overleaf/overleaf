const { expect } = require('chai')
const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const MockResponse = require('../helpers/MockResponse')

const MODULE_PATH =
  '../../../../app/src/Features/FileStore/FileStoreController.js'

describe('FileStoreController', function () {
  beforeEach(function () {
    this.FileStoreHandler = {
      getFileStream: sinon.stub(),
      getFileSize: sinon.stub(),
    }
    this.ProjectLocator = { findElement: sinon.stub() }
    this.controller = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '@overleaf/settings': this.settings,
        '../Project/ProjectLocator': this.ProjectLocator,
        './FileStoreHandler': this.FileStoreHandler,
      },
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
    }
    this.res = new MockResponse()
    this.file = { name: 'myfile.png' }
  })

  describe('getFile', function () {
    beforeEach(function () {
      this.FileStoreHandler.getFileStream.callsArgWith(3, null, this.stream)
      this.ProjectLocator.findElement.callsArgWith(1, null, this.file)
    })

    it('should call the file store handler with the project_id file_id and any query string', function (done) {
      this.stream.pipe = des => {
        this.FileStoreHandler.getFileStream
          .calledWith(
            this.req.params.Project_id,
            this.req.params.File_id,
            this.req.query
          )
          .should.equal(true)
        done()
      }
      this.controller.getFile(this.req, this.res)
    })

    it('should pipe to res', function (done) {
      this.stream.pipe = des => {
        des.should.equal(this.res)
        done()
      }
      this.controller.getFile(this.req, this.res)
    })

    it('should get the file from the db', function (done) {
      this.stream.pipe = des => {
        const opts = {
          project_id: this.projectId,
          element_id: this.fileId,
          type: 'file',
        }
        this.ProjectLocator.findElement.calledWith(opts).should.equal(true)
        done()
      }
      this.controller.getFile(this.req, this.res)
    })

    it('should set the Content-Disposition header', function (done) {
      this.stream.pipe = des => {
        this.res.setContentDisposition.should.be.calledWith('attachment', {
          filename: this.file.name,
        })
        done()
      }
      this.controller.getFile(this.req, this.res)
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
          it('should not set Content-Type', function (done) {
            this.stream.pipe = des => {
              this.res.headers.should.deep.equal({})
              done()
            }
            this.controller.getFile(this.req, this.res)
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

          it("should set Content-Type to 'text/plain'", function (done) {
            this.stream.pipe = des => {
              this.res.headers.should.deep.equal({
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Content-Type-Options': 'nosniff',
              })
              done()
            }
            this.controller.getFile(this.req, this.res)
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

          it("should set Content-Type to 'text/plain'", function (done) {
            this.stream.pipe = des => {
              this.res.headers.should.deep.equal({
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Content-Type-Options': 'nosniff',
              })
              done()
            }
            this.controller.getFile(this.req, this.res)
          })
        })
      })
    })
    ;[
      // None of these should trigger the iOS/html logic
      ('x.html-is-rad',
      'html.pdf',
      '.html-is-good-for-hidden-files',
      'somefile'),
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
        ;[('iPhone', 'iPad', 'Firefox', 'Chrome')].forEach(browser => {
          describe(`downloaded from ${browser}`, function () {
            beforeEach(function () {
              this.user_agent = `Some ${browser} thing`
            })

            it('Should not set the Content-type', function (done) {
              this.stream.pipe = des => {
                this.res.headers.should.deep.equal({})
                done()
              }
              this.controller.getFile(this.req, this.res)
            })
          })
        })
      })
    })
  })

  describe('getFileHead', function () {
    it('reports the file size', function (done) {
      const expectedFileSize = 99393
      this.FileStoreHandler.getFileSize.yields(
        new Error('getFileSize: unexpected arguments')
      )
      this.FileStoreHandler.getFileSize
        .withArgs(this.projectId, this.fileId)
        .yields(null, expectedFileSize)

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
      this.FileStoreHandler.getFileSize.yields(new Errors.NotFoundError())

      this.res.end = () => {
        expect(this.res.status.lastCall.args).to.deep.equal([404])
        done()
      }

      this.controller.getFileHead(this.req, this.res)
    })

    it('returns 500 on error', function (done) {
      this.FileStoreHandler.getFileSize.yields(new Error('boom!'))

      this.res.end = () => {
        expect(this.res.status.lastCall.args).to.deep.equal([500])
        done()
      }

      this.controller.getFileHead(this.req, this.res)
    })
  })
})
