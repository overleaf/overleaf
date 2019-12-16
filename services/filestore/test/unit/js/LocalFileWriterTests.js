/* eslint-disable
    handle-callback-err,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

const { assert } = require('chai')
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath = '../../../app/js/LocalFileWriter.js'
const SandboxedModule = require('sandboxed-module')

describe('LocalFileWriter', function() {
  beforeEach(function() {
    this.writeStream = {
      on(type, cb) {
        if (type === 'finish') {
          return cb()
        }
      }
    }
    this.readStream = { on() {} }
    this.fs = {
      createWriteStream: sinon.stub().returns(this.writeStream),
      createReadStream: sinon.stub().returns(this.readStream),
      unlink: sinon.stub()
    }
    this.settings = {
      path: {
        uploadFolder: 'somewhere'
      }
    }
    this.writer = SandboxedModule.require(modulePath, {
      requires: {
        fs: this.fs,
        'logger-sharelatex': {
          log() {},
          err() {}
        },
        'settings-sharelatex': this.settings,
        'metrics-sharelatex': {
          inc: sinon.stub(),
          Timer: sinon.stub().returns({ done: sinon.stub() })
        }
      }
    })

    return (this.stubbedFsPath = 'something/uploads/eio2k1j3')
  })

  describe('writeStrem', function() {
    beforeEach(function() {
      return (this.writer._getPath = sinon.stub().returns(this.stubbedFsPath))
    })

    it('write the stream to ./uploads', function(done) {
      const stream = {
        pipe: dest => {
          dest.should.equal(this.writeStream)
          return done()
        },
        on() {}
      }
      return this.writer.writeStream(stream, null, () => {})
    })

    return it('should send the path in the callback', function(done) {
      const stream = {
        pipe: dest => {},
        on(type, cb) {
          if (type === 'end') {
            return cb()
          }
        }
      }
      return this.writer.writeStream(stream, null, (err, fsPath) => {
        fsPath.should.equal(this.stubbedFsPath)
        return done()
      })
    })
  })

  describe('getStream', function() {
    it('should read the stream from the file ', function(done) {
      return this.writer.getStream(this.stubbedFsPath, (err, stream) => {
        this.fs.createReadStream
          .calledWith(this.stubbedFsPath)
          .should.equal(true)
        return done()
      })
    })

    return it('should send the stream in the callback', function(done) {
      return this.writer.getStream(this.stubbedFsPath, (err, readStream) => {
        readStream.should.equal(this.readStream)
        return done()
      })
    })
  })

  return describe('delete file', () =>
    it('should unlink the file', function(done) {
      const error = 'my error'
      this.fs.unlink.callsArgWith(1, error)
      return this.writer.deleteFile(this.stubbedFsPath, err => {
        this.fs.unlink.calledWith(this.stubbedFsPath).should.equal(true)
        err.should.equal(error)
        return done()
      })
    }))
})
