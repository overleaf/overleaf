const { assert, expect } = require('chai')
const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const OError = require('@overleaf/o-error')

const MODULE_PATH = '../../../../app/src/Features/FileStore/FileStoreHandler.js'

describe('FileStoreHandler', function () {
  beforeEach(function () {
    this.fileSize = 999
    this.fs = {
      createReadStream: sinon.stub(),
      lstat: sinon.stub().callsArgWith(1, null, {
        isFile() {
          return true
        },
        isDirectory() {
          return false
        },
        size: this.fileSize,
      }),
    }
    this.writeStream = {
      my: 'writeStream',
      on(type, fn) {
        if (type === 'response') {
          fn({ statusCode: 200 })
        }
      },
    }
    this.readStream = { my: 'readStream', on: sinon.stub() }
    this.request = sinon.stub()
    this.request.head = sinon.stub()
    this.filestoreUrl = 'http://filestore.overleaf.test'
    this.settings = {
      apis: { filestore: { url: this.filestoreUrl } },
    }
    this.hashValue = '0123456789'
    this.fileArgs = { name: 'upload-filename' }
    this.fileId = 'file_id_here'
    this.projectId = '1312312312'
    this.historyId = 123
    this.hashValue = '2aae6c35c94fcfb415dbe95f408b9ce91ee846ed'
    this.fsPath = 'uploads/myfile.eps'
    this.getFileUrl = (projectId, fileId) =>
      `${this.filestoreUrl}/project/${projectId}/file/${fileId}`
    this.getProjectUrl = projectId =>
      `${this.filestoreUrl}/project/${projectId}`
    this.FileModel = class File {
      constructor(options) {
        ;({ name: this.name, hash: this.hash } = options)
        this._id = 'file_id_here'
        this.rev = 0
        if (options.linkedFileData != null) {
          this.linkedFileData = options.linkedFileData
        }
      }
    }
    this.FileHashManager = {
      computeHash: sinon.stub().callsArgWith(1, null, this.hashValue),
    }
    this.HistoryManager = {
      uploadBlobFromDisk: sinon.stub().callsArg(4),
    }
    this.ProjectDetailsHandler = {
      getDetails: sinon.stub().callsArgWith(1, null, {
        overleaf: { history: { id: this.historyId } },
      }),
    }

    this.Features = {
      hasFeature: sinon.stub(),
    }

    this.handler = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '@overleaf/settings': this.settings,
        request: this.request,
        '../History/HistoryManager': this.HistoryManager,
        '../Project/ProjectDetailsHandler': this.ProjectDetailsHandler,
        './FileHashManager': this.FileHashManager,
        '../../infrastructure/Features': this.Features,
        // FIXME: need to stub File object here
        '../../models/File': {
          File: this.FileModel,
        },
        fs: this.fs,
      },
    })
  })

  describe('uploadFileFromDisk', function () {
    beforeEach(function () {
      this.request.returns(this.writeStream)
    })

    it('should get the project details', function (done) {
      this.fs.createReadStream.returns({
        pipe() {},
        on(type, cb) {
          if (type === 'open') {
            cb()
          }
        },
      })
      this.handler.uploadFileFromDisk(
        this.projectId,
        this.fileArgs,
        this.fsPath,
        () => {
          this.ProjectDetailsHandler.getDetails
            .calledWith(this.projectId)
            .should.equal(true)
          done()
        }
      )
    })

    it('should compute the file hash', function (done) {
      this.fs.createReadStream.returns({
        pipe() {},
        on(type, cb) {
          if (type === 'open') {
            cb()
          }
        },
      })
      this.handler.uploadFileFromDisk(
        this.projectId,
        this.fileArgs,
        this.fsPath,
        () => {
          this.FileHashManager.computeHash
            .calledWith(this.fsPath)
            .should.equal(true)
          done()
        }
      )
    })

    describe('when project-history-blobs feature is enabled', function () {
      it('should upload the file to the history store as a blob', function (done) {
        this.fs.createReadStream.returns({
          pipe() {},
          on(type, cb) {
            if (type === 'open') {
              cb()
            }
          },
        })
        this.Features.hasFeature.withArgs('project-history-blobs').returns(true)
        this.handler.uploadFileFromDisk(
          this.projectId,
          this.fileArgs,
          this.fsPath,
          () => {
            this.HistoryManager.uploadBlobFromDisk
              .calledWith(
                this.historyId,
                this.hashValue,
                this.fileSize,
                this.fsPath
              )
              .should.equal(true)
            done()
          }
        )
      })
    })
    describe('when project-history-blobs feature is disabled', function () {
      it('should not upload the file to the history store as a blob', function (done) {
        this.fs.createReadStream.returns({
          pipe() {},
          on(type, cb) {
            if (type === 'open') {
              cb()
            }
          },
        })
        this.handler.uploadFileFromDisk(
          this.projectId,
          this.fileArgs,
          this.fsPath,
          () => {
            this.HistoryManager.uploadBlobFromDisk.called.should.equal(false)
            done()
          }
        )
      })
    })

    describe('when filestore feature is enabled', function () {
      beforeEach(function () {
        this.Features.hasFeature.withArgs('filestore').returns(true)
      })
      it('should create read stream', function (done) {
        this.fs.createReadStream.returns({
          pipe() {},
          on(type, cb) {
            if (type === 'open') {
              cb()
            }
          },
        })
        this.handler.uploadFileFromDisk(
          this.projectId,
          this.fileArgs,
          this.fsPath,
          () => {
            this.fs.createReadStream.calledWith(this.fsPath).should.equal(true)
            done()
          }
        )
      })

      it('should pipe the read stream to request', function (done) {
        this.request.returns(this.writeStream)
        this.fs.createReadStream.returns({
          on(type, cb) {
            if (type === 'open') {
              cb()
            }
          },
          pipe: o => {
            this.writeStream.should.equal(o)
            done()
          },
        })
        this.handler.uploadFileFromDisk(
          this.projectId,
          this.fileArgs,
          this.fsPath,
          () => {}
        )
      })

      it('should pass the correct options to request', function (done) {
        const fileUrl = this.getFileUrl(this.projectId, this.fileId)
        this.fs.createReadStream.returns({
          pipe() {},
          on(type, cb) {
            if (type === 'open') {
              cb()
            }
          },
        })
        this.handler.uploadFileFromDisk(
          this.projectId,
          this.fileArgs,
          this.fsPath,
          () => {
            this.request.args[0][0].method.should.equal('post')
            this.request.args[0][0].uri.should.equal(fileUrl)
            done()
          }
        )
      })

      it('should callback with the url and fileRef', function (done) {
        const fileUrl = this.getFileUrl(this.projectId, this.fileId)
        this.fs.createReadStream.returns({
          pipe() {},
          on(type, cb) {
            if (type === 'open') {
              cb()
            }
          },
        })
        this.handler.uploadFileFromDisk(
          this.projectId,
          this.fileArgs,
          this.fsPath,
          (err, url, fileRef) => {
            expect(err).to.not.exist
            expect(url).to.equal(fileUrl)
            expect(fileRef._id).to.equal(this.fileId)
            expect(fileRef.hash).to.equal(this.hashValue)
            done()
          }
        )
      })
      describe('when upload to filestore fails', function () {
        beforeEach(function () {
          this.writeStream.on = function (type, fn) {
            if (type === 'response') {
              fn({ statusCode: 500 })
            }
          }
        })

        it('should callback with an error', function (done) {
          this.fs.createReadStream.callCount = 0
          this.fs.createReadStream.returns({
            pipe() {},
            on(type, cb) {
              if (type === 'open') {
                cb()
              }
            },
          })
          this.handler.uploadFileFromDisk(
            this.projectId,
            this.fileArgs,
            this.fsPath,
            err => {
              expect(err).to.exist
              expect(err).to.be.instanceof(Error)
              expect(this.fs.createReadStream.callCount).to.equal(
                this.handler.RETRY_ATTEMPTS
              )
              done()
            }
          )
        })
      })
    })
    describe('when filestore feature is disabled', function () {
      beforeEach(function () {
        this.Features.hasFeature.withArgs('filestore').returns(false)
      })
      it('should not open file handle', function (done) {
        this.handler.uploadFileFromDisk(
          this.projectId,
          this.fileArgs,
          this.fsPath,
          () => {
            expect(this.fs.createReadStream).to.not.have.been.called
            done()
          }
        )
      })

      it('should not talk to filestore', function (done) {
        this.handler.uploadFileFromDisk(
          this.projectId,
          this.fileArgs,
          this.fsPath,
          () => {
            expect(this.request).to.not.have.been.called
            done()
          }
        )
      })

      it('should callback with the url and fileRef', function (done) {
        const fileUrl = this.getFileUrl(this.projectId, this.fileId)
        this.handler.uploadFileFromDisk(
          this.projectId,
          this.fileArgs,
          this.fsPath,
          (err, url, fileRef) => {
            expect(err).to.not.exist
            expect(url).to.equal(fileUrl)
            expect(fileRef._id).to.equal(this.fileId)
            expect(fileRef.hash).to.equal(this.hashValue)
            done()
          }
        )
      })
    })

    describe('symlink', function () {
      it('should not read file if it is symlink', function (done) {
        this.fs.lstat = sinon.stub().callsArgWith(1, null, {
          isFile() {
            return false
          },
          isDirectory() {
            return false
          },
        })

        this.handler.uploadFileFromDisk(
          this.projectId,
          this.fileArgs,
          this.fsPath,
          () => {
            this.fs.createReadStream.called.should.equal(false)
            done()
          }
        )
      })

      it('should not read file stat returns nothing', function (done) {
        this.fs.lstat = sinon.stub().callsArgWith(1, null, null)
        this.handler.uploadFileFromDisk(
          this.projectId,
          this.fileArgs,
          this.fsPath,
          () => {
            this.fs.createReadStream.called.should.equal(false)
            done()
          }
        )
      })
    })
  })

  describe('deleteFile', function () {
    it('should send a delete request to filestore api', function (done) {
      const fileUrl = this.getFileUrl(this.projectId, this.fileId)
      this.request.callsArgWith(1, null)

      this.handler.deleteFile(this.projectId, this.fileId, err => {
        assert.equal(err, undefined)
        this.request.args[0][0].method.should.equal('delete')
        this.request.args[0][0].uri.should.equal(fileUrl)
        done()
      })
    })

    it('should return the error if there is one', function (done) {
      const error = 'my error'
      this.request.callsArgWith(1, error)
      this.handler.deleteFile(this.projectId, this.fileId, err => {
        assert.equal(err, error)
        done()
      })
    })
  })

  describe('deleteProject', function () {
    it('should send a delete request to filestore api', function (done) {
      const projectUrl = this.getProjectUrl(this.projectId)
      this.request.callsArgWith(1, null)

      this.handler.deleteProject(this.projectId, err => {
        assert.equal(err, undefined)
        this.request.args[0][0].method.should.equal('delete')
        this.request.args[0][0].uri.should.equal(projectUrl)
        done()
      })
    })

    it('should wrap the error if there is one', function (done) {
      const error = new Error('my error')
      this.request.callsArgWith(1, error)
      this.handler.deleteProject(this.projectId, err => {
        expect(OError.getFullStack(err)).to.match(
          /something went wrong deleting a project in filestore/
        )
        expect(OError.getFullStack(err)).to.match(/my error/)
        done()
      })
    })
  })

  describe('getFileStream', function () {
    beforeEach(function () {
      this.query = {}
      this.request.returns(this.readStream)
    })

    it('should get the stream with the correct params', function (done) {
      const fileUrl = this.getFileUrl(this.projectId, this.fileId)
      this.handler.getFileStream(
        this.projectId,
        this.fileId,
        this.query,
        (err, stream) => {
          if (err) {
            return done(err)
          }
          this.request.args[0][0].method.should.equal('get')
          this.request.args[0][0].uri.should.equal(
            fileUrl + '?from=getFileStream'
          )
          done()
        }
      )
    })

    it('should get stream from request', function (done) {
      this.handler.getFileStream(
        this.projectId,
        this.fileId,
        this.query,
        (err, stream) => {
          if (err) {
            return done(err)
          }
          stream.should.equal(this.readStream)
          done()
        }
      )
    })

    it('should add an error handler', function (done) {
      this.handler.getFileStream(
        this.projectId,
        this.fileId,
        this.query,
        (err, stream) => {
          if (err) {
            return done(err)
          }
          stream.on.calledWith('error').should.equal(true)
          done()
        }
      )
    })

    describe('when range is specified in query', function () {
      beforeEach(function () {
        this.query = { range: '0-10' }
      })

      it('should add a range header', function (done) {
        this.handler.getFileStream(
          this.projectId,
          this.fileId,
          this.query,
          (err, stream) => {
            if (err) {
              return done(err)
            }
            this.request.callCount.should.equal(1)
            const { headers } = this.request.firstCall.args[0]
            expect(headers).to.have.keys('range')
            expect(headers.range).to.equal('bytes=0-10')
            done()
          }
        )
      })

      describe('when range is invalid', function () {
        ;['0-', '-100', 'one-two', 'nonsense'].forEach(r => {
          beforeEach(function () {
            this.query = { range: `${r}` }
          })

          it(`should not add a range header for '${r}'`, function (done) {
            this.handler.getFileStream(
              this.projectId,
              this.fileId,
              this.query,
              (err, stream) => {
                if (err) {
                  return done(err)
                }
                this.request.callCount.should.equal(1)
                const { headers } = this.request.firstCall.args[0]
                expect(headers).to.not.have.keys('range')
                done()
              }
            )
          })
        })
      })
    })
  })

  describe('getFileSize', function () {
    it('returns the file size reported by filestore', function (done) {
      const expectedFileSize = 32432
      const fileUrl =
        this.getFileUrl(this.projectId, this.fileId) + '?from=getFileSize'
      this.request.head.yields(
        new Error('request.head() received unexpected arguments')
      )
      this.request.head.withArgs(fileUrl).yields(null, {
        statusCode: 200,
        headers: {
          'content-length': expectedFileSize,
        },
      })

      this.handler.getFileSize(this.projectId, this.fileId, (err, fileSize) => {
        if (err) {
          return done(err)
        }
        expect(fileSize).to.equal(expectedFileSize)
        done()
      })
    })

    it('throws a NotFoundError on a 404 from filestore', function (done) {
      this.request.head.yields(null, { statusCode: 404 })

      this.handler.getFileSize(this.projectId, this.fileId, err => {
        expect(err).to.be.instanceof(Errors.NotFoundError)
        done()
      })
    })

    it('throws an error on a non-200 from filestore', function (done) {
      this.request.head.yields(null, { statusCode: 500 })

      this.handler.getFileSize(this.projectId, this.fileId, err => {
        expect(err).to.be.instanceof(Error)
        done()
      })
    })

    it('rethrows errors from filestore', function (done) {
      this.request.head.yields(new Error())

      this.handler.getFileSize(this.projectId, this.fileId, err => {
        expect(err).to.be.instanceof(Error)
        done()
      })
    })
  })

  describe('copyFile', function () {
    beforeEach(function () {
      this.newProjectId = 'new project'
      this.newFileId = 'new file id'
    })

    it('should post json', function (done) {
      const newFileUrl = this.getFileUrl(this.newProjectId, this.newFileId)
      this.request.callsArgWith(1, null, { statusCode: 200 })

      this.handler.copyFile(
        this.projectId,
        this.fileId,
        this.newProjectId,
        this.newFileId,
        () => {
          this.request.args[0][0].method.should.equal('put')
          this.request.args[0][0].uri.should.equal(newFileUrl)
          this.request.args[0][0].json.source.project_id.should.equal(
            this.projectId
          )
          this.request.args[0][0].json.source.file_id.should.equal(this.fileId)
          done()
        }
      )
    })

    it('returns the url', function (done) {
      const expectedUrl = this.getFileUrl(this.newProjectId, this.newFileId)
      this.request.callsArgWith(1, null, { statusCode: 200 })
      this.handler.copyFile(
        this.projectId,
        this.fileId,
        this.newProjectId,
        this.newFileId,
        (err, url) => {
          if (err) {
            return done(err)
          }
          url.should.equal(expectedUrl)
          done()
        }
      )
    })

    it('should return the err', function (done) {
      const error = new Error('error')
      this.request.callsArgWith(1, error)
      this.handler.copyFile(
        this.projectId,
        this.fileId,
        this.newProjectId,
        this.newFileId,
        err => {
          err.should.equal(error)
          done()
        }
      )
    })

    it('should return an error for a non-success statusCode', function (done) {
      this.request.callsArgWith(1, null, { statusCode: 500 })
      this.handler.copyFile(
        this.projectId,
        this.fileId,
        this.newProjectId,
        this.newFileId,
        err => {
          err.should.be.an('error')
          err.message.should.equal(
            'non-ok response from filestore for copyFile: 500'
          )
          done()
        }
      )
    })
  })
})
