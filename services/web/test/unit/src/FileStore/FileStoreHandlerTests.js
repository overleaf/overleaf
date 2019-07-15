const { assert } = require('chai')
const sinon = require('sinon')
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')

const MODULE_PATH = '../../../../app/src/Features/FileStore/FileStoreHandler.js'

describe('FileStoreHandler', function() {
  beforeEach(function() {
    this.fs = {
      createReadStream: sinon.stub(),
      lstat: sinon.stub().callsArgWith(1, null, {
        isFile() {
          return true
        },
        isDirectory() {
          return false
        }
      })
    }
    this.writeStream = {
      my: 'writeStream',
      on(type, cb) {
        if (type === 'response') {
          // eslint-disable-next-line standard/no-callback-literal
          cb({ statusCode: 200 })
        }
      }
    }
    this.readStream = { my: 'readStream', on: sinon.stub() }
    this.request = sinon.stub()
    this.request.head = sinon.stub()
    this.filestoreUrl = 'http://filestore.sharelatex.test'
    this.settings = {
      apis: { filestore: { url: this.filestoreUrl } }
    }
    this.hashValue = '0123456789'
    this.fileArgs = { name: 'upload-filename' }
    this.fileId = 'file_id_here'
    this.projectId = '1312312312'
    this.fsPath = 'uploads/myfile.eps'
    this.getFileUrl = (projectId, fileId) =>
      `${this.filestoreUrl}/project/${projectId}/file/${fileId}`
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
    this.Errors = {
      NotFoundError: sinon.stub()
    }
    this.logger = {
      log: sinon.stub(),
      warn: sinon.stub(),
      err: sinon.stub()
    }
    this.FileHashManager = {
      computeHash: sinon.stub().callsArgWith(1, null, this.hashValue)
    }
    this.handler = SandboxedModule.require(MODULE_PATH, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': this.settings,
        request: this.request,
        'logger-sharelatex': this.logger,
        './FileHashManager': this.FileHashManager,
        // FIXME: need to stub File object here
        '../../models/File': {
          File: this.FileModel
        },
        '../Errors/Errors': this.Errors,
        fs: this.fs
      }
    })
  })

  describe('uploadFileFromDisk', function() {
    beforeEach(function() {
      this.request.returns(this.writeStream)
    })

    it('should create read stream', function(done) {
      this.fs.createReadStream.returns({
        pipe() {},
        on(type, cb) {
          if (type === 'open') {
            cb()
          }
        }
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

    it('should pipe the read stream to request', function(done) {
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
        }
      })
      this.handler.uploadFileFromDisk(
        this.projectId,
        this.fileArgs,
        this.fsPath,
        () => {}
      )
    })

    it('should pass the correct options to request', function(done) {
      const fileUrl = this.getFileUrl(this.projectId, this.fileId)
      this.fs.createReadStream.returns({
        pipe() {},
        on(type, cb) {
          if (type === 'open') {
            cb()
          }
        }
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

    it('should callback with the url and fileRef', function(done) {
      const fileUrl = this.getFileUrl(this.projectId, this.fileId)
      this.fs.createReadStream.returns({
        pipe() {},
        on(type, cb) {
          if (type === 'open') {
            cb()
          }
        }
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

    describe('symlink', function() {
      it('should not read file if it is symlink', function(done) {
        this.fs.lstat = sinon.stub().callsArgWith(1, null, {
          isFile() {
            return false
          },
          isDirectory() {
            return false
          }
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

      it('should not read file stat returns nothing', function(done) {
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

    describe('when upload fails', function() {
      beforeEach(function() {
        this.writeStream.on = function(type, cb) {
          if (type === 'response') {
            // eslint-disable-next-line standard/no-callback-literal
            cb({ statusCode: 500 })
          }
        }
      })

      it('should callback with an error', function(done) {
        this.fs.createReadStream.callCount = 0
        this.fs.createReadStream.returns({
          pipe() {},
          on(type, cb) {
            if (type === 'open') {
              cb()
            }
          }
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

  describe('deleteFile', function() {
    it('should send a delete request to filestore api', function(done) {
      const fileUrl = this.getFileUrl(this.projectId, this.fileId)
      this.request.callsArgWith(1, null)

      this.handler.deleteFile(this.projectId, this.fileId, err => {
        assert.equal(err, undefined)
        this.request.args[0][0].method.should.equal('delete')
        this.request.args[0][0].uri.should.equal(fileUrl)
        done()
      })
    })

    it('should return the error if there is one', function(done) {
      const error = 'my error'
      this.request.callsArgWith(1, error)
      this.handler.deleteFile(this.projectId, this.fileId, err => {
        assert.equal(err, error)
        done()
      })
    })
  })

  describe('getFileStream', function() {
    beforeEach(function() {
      this.query = {}
      this.request.returns(this.readStream)
    })

    it('should get the stream with the correct params', function(done) {
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
          this.request.args[0][0].uri.should.equal(fileUrl)
          done()
        }
      )
    })

    it('should get stream from request', function(done) {
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

    it('should add an error handler', function(done) {
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

    describe('when range is specified in query', function() {
      beforeEach(function() {
        this.query = { range: '0-10' }
      })

      it('should add a range header', function(done) {
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
            expect(headers['range']).to.equal('bytes=0-10')
            done()
          }
        )
      })

      describe('when range is invalid', function() {
        ;['0-', '-100', 'one-two', 'nonsense'].forEach(r => {
          beforeEach(function() {
            this.query = { range: `${r}` }
          })

          it(`should not add a range header for '${r}'`, function(done) {
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

  describe('getFileSize', function() {
    it('returns the file size reported by filestore', function(done) {
      const expectedFileSize = 32432
      const fileUrl = this.getFileUrl(this.projectId, this.fileId)
      this.request.head.yields(
        new Error('request.head() received unexpected arguments')
      )
      this.request.head.withArgs(fileUrl).yields(null, {
        statusCode: 200,
        headers: {
          'content-length': expectedFileSize
        }
      })

      this.handler.getFileSize(this.projectId, this.fileId, (err, fileSize) => {
        if (err) {
          return done(err)
        }
        expect(fileSize).to.equal(expectedFileSize)
        done()
      })
    })

    it('throws a NotFoundError on a 404 from filestore', function(done) {
      this.request.head.yields(null, { statusCode: 404 })

      this.handler.getFileSize(this.projectId, this.fileId, err => {
        expect(err).to.be.instanceof(this.Errors.NotFoundError)
        done()
      })
    })

    it('throws an error on a non-200 from filestore', function(done) {
      this.request.head.yields(null, { statusCode: 500 })

      this.handler.getFileSize(this.projectId, this.fileId, err => {
        expect(err).to.be.instanceof(Error)
        done()
      })
    })

    it('rethrows errors from filestore', function(done) {
      this.request.head.yields(new Error())

      this.handler.getFileSize(this.projectId, this.fileId, err => {
        expect(err).to.be.instanceof(Error)
        done()
      })
    })
  })

  describe('copyFile', function() {
    beforeEach(function() {
      this.newProjectId = 'new project'
      this.newFileId = 'new file id'
    })

    it('should post json', function(done) {
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

    it('returns the url', function(done) {
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

    it('should return the err', function(done) {
      const error = 'errrror'
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

    it('should return an error for a non-success statusCode', function(done) {
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
