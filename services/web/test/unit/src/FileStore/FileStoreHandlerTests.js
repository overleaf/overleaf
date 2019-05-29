/* eslint-disable
    handle-callback-err,
    max-len,
    mocha/no-identical-title,
    no-return-assign,
    no-unused-vars,
    standard/no-callback-literal,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { assert } = require('chai')
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath = '../../../../app/src/Features/FileStore/FileStoreHandler.js'
const SandboxedModule = require('sandboxed-module')

describe('FileStoreHandler', function() {
  beforeEach(function() {
    let File
    this.fs = {
      createReadStream: sinon.stub(),
      lstat: sinon.stub().callsArgWith(1, null, {
        isFile: () => true,
        isDirectory() {
          return false
        }
      })
    }
    this.writeStream = {
      my: 'writeStream',
      on(type, cb) {
        if (type === 'response') {
          return cb({ statusCode: 200 })
        }
      }
    }
    this.readStream = { my: 'readStream', on: sinon.stub() }
    this.request = sinon.stub()
    this.settings = {
      apis: { filestore: { url: 'http//filestore.sharelatex.test' } }
    }
    this.hashValue = '0123456789'
    this.FileModel = File = class File {
      constructor(options) {
        ;({ name: this.name, hash: this.hash } = options)
        this._id = 'file_id_here'
        this.rev = 0
        if (options.linkedFileData != null) {
          this.linkedFileData = options.linkedFileData
        }
      }
    }
    this.handler = SandboxedModule.require(modulePath, {
      requires: {
        'settings-sharelatex': this.settings,
        request: this.request,
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          err: sinon.stub()
        }),
        './FileHashManager': (this.FileHashManager = {
          computeHash: sinon.stub().callsArgWith(1, null, this.hashValue)
        }),
        // FIXME: need to stub File object here
        '../../models/File': {
          File: this.FileModel
        },
        fs: this.fs
      }
    })
    this.file_args = { name: 'upload-filename' }
    this.file_id = 'file_id_here'
    this.project_id = '1312312312'
    this.fsPath = 'uploads/myfile.eps'
    return (this.handler._buildUrl = sinon
      .stub()
      .returns('http://filestore.stubbedBuilder.com'))
  })

  describe('uploadFileFromDisk', function() {
    beforeEach(function() {
      return this.request.returns(this.writeStream)
    })

    it('should create read stream', function(done) {
      this.fs.createReadStream.returns({
        pipe() {},
        on(type, cb) {
          if (type === 'open') {
            return cb()
          }
        }
      })
      return this.handler.uploadFileFromDisk(
        this.project_id,
        this.file_args,
        this.fsPath,
        () => {
          this.fs.createReadStream.calledWith(this.fsPath).should.equal(true)
          return done()
        }
      )
    })

    it('should pipe the read stream to request', function(done) {
      this.request.returns(this.writeStream)
      this.fs.createReadStream.returns({
        on(type, cb) {
          if (type === 'open') {
            return cb()
          }
        },
        pipe: o => {
          this.writeStream.should.equal(o)
          return done()
        }
      })
      return this.handler.uploadFileFromDisk(
        this.project_id,
        this.file_args,
        this.fsPath,
        () => {}
      )
    })

    it('should pass the correct options to request', function(done) {
      this.fs.createReadStream.returns({
        pipe() {},
        on(type, cb) {
          if (type === 'open') {
            return cb()
          }
        }
      })
      return this.handler.uploadFileFromDisk(
        this.project_id,
        this.file_args,
        this.fsPath,
        () => {
          this.request.args[0][0].method.should.equal('post')
          this.request.args[0][0].uri.should.equal(this.handler._buildUrl())
          return done()
        }
      )
    })

    it('builds the correct url', function(done) {
      this.fs.createReadStream.returns({
        pipe() {},
        on(type, cb) {
          if (type === 'open') {
            return cb()
          }
        }
      })
      return this.handler.uploadFileFromDisk(
        this.project_id,
        this.file_args,
        this.fsPath,
        () => {
          this.handler._buildUrl
            .calledWith(this.project_id, this.file_id)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should callback with the url and fileRef', function(done) {
      this.fs.createReadStream.returns({
        pipe() {},
        on(type, cb) {
          if (type === 'open') {
            return cb()
          }
        }
      })
      return this.handler.uploadFileFromDisk(
        this.project_id,
        this.file_args,
        this.fsPath,
        (err, url, fileRef) => {
          expect(err).to.not.exist
          expect(url).to.equal(this.handler._buildUrl())
          expect(fileRef._id).to.equal(this.file_id)
          expect(fileRef.hash).to.equal(this.hashValue)
          return done()
        }
      )
    })

    describe('symlink', function() {
      beforeEach(function() {
        return (this.fs.lstat = sinon.stub().callsArgWith(1, null, {
          isFile: () => false,
          isDirectory() {
            return false
          }
        }))
      })

      return it('should not read file if it is symlink', function(done) {
        return this.handler.uploadFileFromDisk(
          this.project_id,
          this.file_args,
          this.fsPath,
          () => {
            this.fs.createReadStream.called.should.equal(false)
            return done()
          }
        )
      })
    })

    describe('symlink', () =>
      it('should not read file stat returns nothing', function(done) {
        this.fs.lstat = sinon.stub().callsArgWith(1, null, null)
        return this.handler.uploadFileFromDisk(
          this.project_id,
          this.file_args,
          this.fsPath,
          () => {
            this.fs.createReadStream.called.should.equal(false)
            return done()
          }
        )
      }))

    return describe('when upload fails', function() {
      beforeEach(function() {
        return (this.writeStream.on = function(type, cb) {
          if (type === 'response') {
            return cb({ statusCode: 500 })
          }
        })
      })

      return it('should callback with an error', function(done) {
        this.fs.createReadStream.callCount = 0
        this.fs.createReadStream.returns({
          pipe() {},
          on(type, cb) {
            if (type === 'open') {
              return cb()
            }
          }
        })
        return this.handler.uploadFileFromDisk(
          this.project_id,
          this.file_args,
          this.fsPath,
          err => {
            expect(err).to.exist
            expect(err).to.be.instanceof(Error)
            expect(this.fs.createReadStream.callCount).to.equal(
              this.handler.RETRY_ATTEMPTS
            )
            return done()
          }
        )
      })
    })
  })

  describe('deleteFile', function() {
    it('should send a delete request to filestore api', function(done) {
      this.request.callsArgWith(1, null)
      return this.handler.deleteFile(this.project_id, this.file_id, err => {
        assert.equal(err, undefined)
        this.request.args[0][0].method.should.equal('delete')
        this.request.args[0][0].uri.should.equal(this.handler._buildUrl())
        return done()
      })
    })

    it('should return the error if there is one', function(done) {
      const error = 'my error'
      this.request.callsArgWith(1, error)
      return this.handler.deleteFile(this.project_id, this.file_id, err => {
        assert.equal(err, error)
        return done()
      })
    })

    return it('builds the correct url', function(done) {
      this.request.callsArgWith(1, null)
      return this.handler.deleteFile(this.project_id, this.file_id, err => {
        this.handler._buildUrl
          .calledWith(this.project_id, this.file_id)
          .should.equal(true)
        return done()
      })
    })
  })

  describe('getFileStream', function() {
    beforeEach(function() {
      this.query = {}
      return this.request.returns(this.readStream)
    })

    it('should get the stream with the correct params', function(done) {
      return this.handler.getFileStream(
        this.project_id,
        this.file_id,
        this.query,
        (err, stream) => {
          this.request.args[0][0].method.should.equal('get')
          this.request.args[0][0].uri.should.equal(this.handler._buildUrl())
          return done()
        }
      )
    })

    it('should get stream from request', function(done) {
      return this.handler.getFileStream(
        this.project_id,
        this.file_id,
        this.query,
        (err, stream) => {
          stream.should.equal(this.readStream)
          return done()
        }
      )
    })

    it('builds the correct url', function(done) {
      return this.handler.getFileStream(
        this.project_id,
        this.file_id,
        this.query,
        (err, stream) => {
          this.handler._buildUrl
            .calledWith(this.project_id, this.file_id)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should add an error handler', function(done) {
      return this.handler.getFileStream(
        this.project_id,
        this.file_id,
        this.query,
        (err, stream) => {
          stream.on.calledWith('error').should.equal(true)
          return done()
        }
      )
    })

    return describe('when range is specified in query', function() {
      beforeEach(function() {
        return (this.query = { range: '0-10' })
      })

      it('should add a range header', function(done) {
        return this.handler.getFileStream(
          this.project_id,
          this.file_id,
          this.query,
          (err, stream) => {
            this.request.callCount.should.equal(1)
            const { headers } = this.request.firstCall.args[0]
            expect(headers).to.have.keys('range')
            expect(headers['range']).to.equal('bytes=0-10')
            return done()
          }
        )
      })

      return describe('when range is invalid', () =>
        ['0-', '-100', 'one-two', 'nonsense'].forEach(r => {
          beforeEach(function() {
            return (this.query = { range: `${r}` })
          })

          return it(`should not add a range header for '${r}'`, function(done) {
            return this.handler.getFileStream(
              this.project_id,
              this.file_id,
              this.query,
              (err, stream) => {
                this.request.callCount.should.equal(1)
                const { headers } = this.request.firstCall.args[0]
                expect(headers).to.not.have.keys('range')
                return done()
              }
            )
          })
        }))
    })
  })

  return describe('copyFile', function() {
    beforeEach(function() {
      this.newProject_id = 'new project'
      return (this.newFile_id = 'new file id')
    })

    it('should post json', function(done) {
      this.request.callsArgWith(1, null, { statusCode: 200 })

      return this.handler.copyFile(
        this.project_id,
        this.file_id,
        this.newProject_id,
        this.newFile_id,
        () => {
          this.request.args[0][0].method.should.equal('put')
          this.request.args[0][0].uri.should.equal(this.handler._buildUrl())
          this.request.args[0][0].json.source.project_id.should.equal(
            this.project_id
          )
          this.request.args[0][0].json.source.file_id.should.equal(this.file_id)
          return done()
        }
      )
    })

    it('builds the correct url', function(done) {
      this.request.callsArgWith(1, null, { statusCode: 200 })
      return this.handler.copyFile(
        this.project_id,
        this.file_id,
        this.newProject_id,
        this.newFile_id,
        () => {
          this.handler._buildUrl
            .calledWith(this.newProject_id, this.newFile_id)
            .should.equal(true)
          return done()
        }
      )
    })

    it('returns the url', function(done) {
      this.request.callsArgWith(1, null, { statusCode: 200 })
      return this.handler.copyFile(
        this.project_id,
        this.file_id,
        this.newProject_id,
        this.newFile_id,
        (err, url) => {
          url.should.equal('http://filestore.stubbedBuilder.com')
          return done()
        }
      )
    })

    it('should return the err', function(done) {
      const error = 'errrror'
      this.request.callsArgWith(1, error)
      return this.handler.copyFile(
        this.project_id,
        this.file_id,
        this.newProject_id,
        this.newFile_id,
        err => {
          err.should.equal(error)
          return done()
        }
      )
    })

    return it('should return an error for a non-success statusCode', function(done) {
      this.request.callsArgWith(1, null, { statusCode: 500 })
      return this.handler.copyFile(
        this.project_id,
        this.file_id,
        this.newProject_id,
        this.newFile_id,
        err => {
          err.should.be.an('error')
          err.message.should.equal(
            'non-ok response from filestore for copyFile: 500'
          )
          return done()
        }
      )
    })
  })
})
