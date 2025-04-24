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

    it('should get the project details', async function () {
      this.fs.createReadStream.returns({
        pipe() {},
        on(type, cb) {
          if (type === 'open') {
            cb()
          }
        },
      })
      await this.handler.promises.uploadFileFromDisk(
        this.projectId,
        this.fileArgs,
        this.fsPath
      )
      this.ProjectDetailsHandler.getDetails
        .calledWith(this.projectId)
        .should.equal(true)
    })

    it('should compute the file hash', async function () {
      this.fs.createReadStream.returns({
        pipe() {},
        on(type, cb) {
          if (type === 'open') {
            cb()
          }
        },
      })
      await this.handler.promises.uploadFileFromDisk(
        this.projectId,
        this.fileArgs,
        this.fsPath
      )
      this.FileHashManager.computeHash
        .calledWith(this.fsPath)
        .should.equal(true)
    })

    describe('when project-history-blobs feature is enabled', function () {
      it('should upload the file to the history store as a blob', async function () {
        this.fs.createReadStream.returns({
          pipe() {},
          on(type, cb) {
            if (type === 'open') {
              cb()
            }
          },
        })
        this.Features.hasFeature.withArgs('project-history-blobs').returns(true)
        await this.handler.promises.uploadFileFromDisk(
          this.projectId,
          this.fileArgs,
          this.fsPath
        )
        this.HistoryManager.uploadBlobFromDisk
          .calledWith(
            this.historyId,
            this.hashValue,
            this.fileSize,
            this.fsPath
          )
          .should.equal(true)
      })
    })
    describe('when project-history-blobs feature is disabled', function () {
      it('should not upload the file to the history store as a blob', async function () {
        this.fs.createReadStream.returns({
          pipe() {},
          on(type, cb) {
            if (type === 'open') {
              cb()
            }
          },
        })
        await this.handler.promises.uploadFileFromDisk(
          this.projectId,
          this.fileArgs,
          this.fsPath
        )
        this.HistoryManager.uploadBlobFromDisk.called.should.equal(false)
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

      it('should pipe the read stream to request', function () {
        this.request.returns(this.writeStream)
        return new Promise((resolve, reject) => {
          this.fs.createReadStream.returns({
            on(type, cb) {
              if (type === 'open') {
                cb()
              }
            },
            pipe: o => {
              this.writeStream.should.equal(o)
              resolve()
            },
          })
          this.handler.promises
            .uploadFileFromDisk(this.projectId, this.fileArgs, this.fsPath)
            .catch(reject)
        })
      })

      it('should pass the correct options to request', async function () {
        const fileUrl = this.getFileUrl(this.projectId, this.fileId)
        this.fs.createReadStream.returns({
          pipe: sinon.stub(),
          on: sinon.stub((type, cb) => {
            if (type === 'open') {
              cb()
            }
          }),
        })
        await this.handler.promises.uploadFileFromDisk(
          this.projectId,
          this.fileArgs,
          this.fsPath
        )
        this.request.args[0][0].method.should.equal('post')
        this.request.args[0][0].uri.should.equal(fileUrl)
      })

      it('should resolve with the url and fileRef', async function () {
        const fileUrl = this.getFileUrl(this.projectId, this.fileId)
        this.fs.createReadStream.returns({
          pipe: sinon.stub(),
          on: sinon.stub((type, cb) => {
            if (type === 'open') {
              cb()
            }
          }),
        })
        const { url, fileRef } = await this.handler.promises.uploadFileFromDisk(
          this.projectId,
          this.fileArgs,
          this.fsPath
        )
        expect(url).to.equal(fileUrl)
        expect(fileRef._id).to.equal(this.fileId)
        expect(fileRef.hash).to.equal(this.hashValue)
      })
      describe('when upload to filestore fails', function () {
        beforeEach(function () {
          this.writeStream.on = function (type, fn) {
            if (type === 'response') {
              fn({ statusCode: 500 })
            }
          }
        })

        it('should reject with an error', async function () {
          this.fs.createReadStream.callCount = 0
          this.fs.createReadStream.returns({
            pipe: sinon.stub(),
            on: sinon.stub((type, cb) => {
              if (type === 'open') {
                cb()
              }
            }),
          })
          let error

          try {
            await this.handler.promises.uploadFileFromDisk(
              this.projectId,
              this.fileArgs,
              this.fsPath
            )
          } catch (err) {
            error = err
          }

          expect(error).to.be.instanceOf(Error)

          expect(this.fs.createReadStream.callCount).to.equal(
            this.handler.RETRY_ATTEMPTS
          )
        })
      })
    })
    describe('when filestore feature is disabled', function () {
      beforeEach(function () {
        this.Features.hasFeature.withArgs('filestore').returns(false)
      })
      it('should not open file handle', async function () {
        await this.handler.promises.uploadFileFromDisk(
          this.projectId,
          this.fileArgs,
          this.fsPath
        )
        expect(this.fs.createReadStream).to.not.have.been.called
      })

      it('should not talk to filestore', async function () {
        await this.handler.promises.uploadFileFromDisk(
          this.projectId,
          this.fileArgs,
          this.fsPath
        )

        expect(this.request).to.not.have.been.called
      })

      it('should resolve with the url and fileRef', async function () {
        const fileUrl = this.getFileUrl(this.projectId, this.fileId)
        const { url, fileRef } = await this.handler.promises.uploadFileFromDisk(
          this.projectId,
          this.fileArgs,
          this.fsPath
        )
        expect(url).to.equal(fileUrl)
        expect(fileRef._id).to.equal(this.fileId)
        expect(fileRef.hash).to.equal(this.hashValue)
      })
    })

    describe('symlink', function () {
      it('should not read file if it is symlink', async function () {
        this.fs.lstat = sinon.stub().callsArgWith(1, null, {
          isFile() {
            return false
          },
          isDirectory() {
            return false
          },
        })

        let error

        try {
          await this.handler.promises.uploadFileFromDisk(
            this.projectId,
            this.fileArgs,
            this.fsPath
          )
        } catch (err) {
          error = err
        }

        expect(error).to.exist

        this.fs.createReadStream.called.should.equal(false)
      })

      it('should not read file stat returns nothing', async function () {
        this.fs.lstat = sinon.stub().callsArgWith(1, null, null)
        let error

        try {
          await this.handler.promises.uploadFileFromDisk(
            this.projectId,
            this.fileArgs,
            this.fsPath
          )
        } catch (err) {
          error = err
        }

        expect(error).to.exist

        this.fs.createReadStream.called.should.equal(false)
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

    it('should reject with the error if there is one', async function () {
      const expectedError = 'my error'
      this.request.callsArgWith(1, expectedError)
      let error

      try {
        await this.handler.promises.deleteFile(this.projectId, this.fileId)
      } catch (err) {
        error = err
      }

      expect(error).to.equal(expectedError)
    })
  })

  describe('deleteProject', function () {
    describe('when filestore is enabled', function () {
      beforeEach(function () {
        this.Features.hasFeature.withArgs('filestore').returns(true)
      })
      it('should send a delete request to filestore api', async function () {
        const projectUrl = this.getProjectUrl(this.projectId)
        this.request.callsArgWith(1, null)

        await this.handler.promises.deleteProject(this.projectId)
        this.request.args[0][0].method.should.equal('delete')
        this.request.args[0][0].uri.should.equal(projectUrl)
      })

      it('should wrap the error if there is one', async function () {
        const expectedError = new Error('my error')
        this.request.callsArgWith(1, expectedError)
        const promise = this.handler.promises.deleteProject(this.projectId)
        let error

        try {
          await promise
        } catch (err) {
          error = err
        }

        expect(error).to.exist

        expect(OError.getFullStack(error)).to.match(
          /something went wrong deleting a project in filestore/
        )
        expect(OError.getFullStack(error)).to.match(/my error/)
      })
    })
    describe('when filestore is disabled', function () {
      beforeEach(function () {
        this.Features.hasFeature.withArgs('filestore').returns(false)
      })
      it('should not send a delete request to filestore api', async function () {
        await this.handler.promises.deleteProject(this.projectId)

        this.request.called.should.equal(false)
      })
    })
  })

  describe('getFileStream', function () {
    describe('when filestore is disabled', function () {
      beforeEach(function () {
        this.Features.hasFeature.withArgs('filestore').returns(false)
      })

      it('should callback with a NotFoundError', async function () {
        let error

        try {
          await this.handler.promises.getFileStream(
            this.projectId,
            this.fileId,
            {}
          )
        } catch (err) {
          error = err
        }

        expect(error).to.be.instanceOf(Errors.NotFoundError)
      })

      it('should not call request', async function () {
        let error

        try {
          await this.handler.promises.getFileStream(
            this.projectId,
            this.fileId,
            {}
          )
        } catch (err) {
          error = err
        }

        expect(error).to.exist
        this.request.called.should.equal(false)
      })
    })
    describe('when filestore is enabled', function () {
      beforeEach(function () {
        this.query = {}
        this.request.returns(this.readStream)
        this.Features.hasFeature.withArgs('filestore').returns(true)
      })

      it('should get the stream with the correct params', async function () {
        const fileUrl = this.getFileUrl(this.projectId, this.fileId)
        await this.handler.promises.getFileStream(
          this.projectId,
          this.fileId,
          this.query
        )
        this.request.args[0][0].method.should.equal('get')
        this.request.args[0][0].uri.should.equal(
          fileUrl + '?from=getFileStream'
        )
      })

      it('should get stream from request', async function () {
        const stream = await this.handler.promises.getFileStream(
          this.projectId,
          this.fileId,
          this.query
        )

        stream.should.equal(this.readStream)
      })

      it('should add an error handler', async function () {
        const stream = await this.handler.promises.getFileStream(
          this.projectId,
          this.fileId,
          this.query
        )
        stream.on.calledWith('error').should.equal(true)
      })

      describe('when range is specified in query', function () {
        beforeEach(function () {
          this.query = { range: '0-10' }
        })

        it('should add a range header', async function () {
          await this.handler.promises.getFileStream(
            this.projectId,
            this.fileId,
            this.query
          )

          this.request.callCount.should.equal(1)
          const { headers } = this.request.firstCall.args[0]
          expect(headers).to.have.keys('range')
          expect(headers.range).to.equal('bytes=0-10')
        })

        describe('when range is invalid', function () {
          ;['0-', '-100', 'one-two', 'nonsense'].forEach(r => {
            beforeEach(function () {
              this.query = { range: `${r}` }
            })

            it(`should not add a range header for '${r}'`, async function () {
              await this.handler.promises.getFileStream(
                this.projectId,
                this.fileId,
                this.query
              )
              this.request.callCount.should.equal(1)
              const { headers } = this.request.firstCall.args[0]
              expect(headers).to.not.have.keys('range')
            })
          })
        })
      })
    })
  })

  describe('getFileSize', function () {
    it('returns the file size reported by filestore', async function () {
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

      const fileSize = await this.handler.promises.getFileSize(
        this.projectId,
        this.fileId
      )
      expect(fileSize).to.equal(expectedFileSize)
    })

    it('throws a NotFoundError on a 404 from filestore', async function () {
      this.request.head.yields(null, { statusCode: 404 })

      let error

      try {
        await this.handler.promises.getFileSize(this.projectId, this.fileId)
      } catch (err) {
        error = err
      }

      expect(error).to.be.instanceOf(Errors.NotFoundError)
    })

    it('throws an error on a non-200 from filestore', async function () {
      this.request.head.yields(null, { statusCode: 500 })

      let error

      try {
        await this.handler.promises.getFileSize(this.projectId, this.fileId)
      } catch (err) {
        error = err
      }

      expect(error).to.be.instanceOf(Error)
    })

    it('rethrows errors from filestore', async function () {
      const expectedError = new Error('from filestore')
      this.request.head.yields(expectedError)

      let error

      try {
        await this.handler.promises.getFileSize(this.projectId, this.fileId)
      } catch (err) {
        error = err
      }

      expect(error).to.equal(expectedError)
    })
  })

  describe('copyFile', function () {
    beforeEach(function () {
      this.newProjectId = 'new project'
      this.newFileId = 'new file id'
    })

    it('should post json', async function () {
      const newFileUrl = this.getFileUrl(this.newProjectId, this.newFileId)
      this.request.callsArgWith(1, null, { statusCode: 200 })

      await this.handler.promises.copyFile(
        this.projectId,
        this.fileId,
        this.newProjectId,
        this.newFileId
      )
      this.request.args[0][0].method.should.equal('put')
      this.request.args[0][0].uri.should.equal(newFileUrl)
      this.request.args[0][0].json.source.project_id.should.equal(
        this.projectId
      )
      this.request.args[0][0].json.source.file_id.should.equal(this.fileId)
    })

    it('returns the url', async function () {
      const expectedUrl = this.getFileUrl(this.newProjectId, this.newFileId)
      this.request.callsArgWith(1, null, { statusCode: 200 })
      const url = await this.handler.promises.copyFile(
        this.projectId,
        this.fileId,
        this.newProjectId,
        this.newFileId
      )

      url.should.equal(expectedUrl)
    })

    it('should return the err', async function () {
      const expectedError = new Error('error')
      this.request.callsArgWith(1, expectedError)
      let error

      try {
        await this.handler.promises.copyFile(
          this.projectId,
          this.fileId,
          this.newProjectId,
          this.newFileId
        )
      } catch (err) {
        error = err
      }

      expect(error).to.equal(expectedError)
    })

    it('should return an error for a non-success statusCode', async function () {
      this.request.callsArgWith(1, null, { statusCode: 500 })
      let error

      try {
        await this.handler.promises.copyFile(
          this.projectId,
          this.fileId,
          this.newProjectId,
          this.newFileId
        )
      } catch (err) {
        error = err
      }

      expect(error).to.be.instanceOf(Error)
      expect(error).to.have.property(
        'message',
        'non-ok response from filestore for copyFile: 500'
      )
    })
  })
})
