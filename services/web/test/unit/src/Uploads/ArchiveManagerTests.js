/* eslint-disable
    handle-callback-err,
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
const { expect } = require('chai')
const chai = require('chai')
const should = chai.should()
const modulePath = '../../../../app/src/Features/Uploads/ArchiveManager.js'
const Errors = require('../../../../app/src/Features/Errors/Errors')
const SandboxedModule = require('sandboxed-module')
const events = require('events')

describe('ArchiveManager', function() {
  beforeEach(function() {
    let Timer
    this.logger = {
      error: sinon.stub(),
      warn: sinon.stub(),
      err() {},
      log: sinon.stub()
    }
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
    this.zipfile = new events.EventEmitter()
    this.zipfile.readEntry = sinon.stub()
    this.zipfile.close = sinon.stub()

    this.ArchiveManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        yauzl: (this.yauzl = {
          open: sinon.stub().callsArgWith(2, null, this.zipfile)
        }),
        'logger-sharelatex': this.logger,
        'metrics-sharelatex': this.metrics,
        fs: (this.fs = {}),
        'fs-extra': (this.fse = {})
      }
    })
    return (this.callback = sinon.stub())
  })

  describe('extractZipArchive', function() {
    beforeEach(function() {
      this.source = '/path/to/zip/source.zip'
      this.destination = '/path/to/zip/destination'
      return (this.ArchiveManager._isZipTooLarge = sinon
        .stub()
        .callsArgWith(1, null, false))
    })

    describe('successfully', function() {
      beforeEach(function(done) {
        this.readStream = new events.EventEmitter()
        this.readStream.pipe = sinon.stub()
        this.zipfile.openReadStream = sinon
          .stub()
          .callsArgWith(1, null, this.readStream)
        this.writeStream = new events.EventEmitter()
        this.fs.createWriteStream = sinon.stub().returns(this.writeStream)
        this.fse.ensureDir = sinon.stub().callsArg(1)
        this.ArchiveManager.extractZipArchive(
          this.source,
          this.destination,
          done
        )

        // entry contains a single file
        this.zipfile.emit('entry', { fileName: 'testfile.txt' })
        this.readStream.emit('end')
        return this.zipfile.emit('end')
      })

      it('should run yauzl', function() {
        return this.yauzl.open.calledWith(this.source).should.equal(true)
      })

      it('should time the unzip', function() {
        return this.metrics.Timer.prototype.done.called.should.equal(true)
      })

      it('should log the unzip', function() {
        return this.logger.log
          .calledWith(sinon.match.any, 'unzipping file')
          .should.equal(true)
      })
    })

    describe('with a zipfile containing an empty directory', function() {
      beforeEach(function(done) {
        this.readStream = new events.EventEmitter()
        this.readStream.pipe = sinon.stub()
        this.zipfile.openReadStream = sinon
          .stub()
          .callsArgWith(1, null, this.readStream)
        this.writeStream = new events.EventEmitter()
        this.fs.createWriteStream = sinon.stub().returns(this.writeStream)
        this.fse.ensureDir = sinon.stub().callsArg(1)
        this.ArchiveManager.extractZipArchive(
          this.source,
          this.destination,
          error => {
            this.callback(error)
            done()
          }
        )

        // entry contains a single, empty directory
        this.zipfile.emit('entry', { fileName: 'testdir/' })
        this.readStream.emit('end')
        return this.zipfile.emit('end')
      })

      it('should return the callback with an error', function() {
        return sinon.assert.calledWithExactly(
          this.callback,
          new Errors.InvalidError('empty_zip_file')
        )
      })
    })

    describe('with an empty zipfile', function() {
      beforeEach(function(done) {
        this.ArchiveManager.extractZipArchive(
          this.source,
          this.destination,
          error => {
            this.callback(error)
            return done()
          }
        )
        return this.zipfile.emit('end')
      })

      it('should return the callback with an error', function() {
        return sinon.assert.calledWithExactly(
          this.callback,
          new Errors.InvalidError('empty_zip_file')
        )
      })
    })

    describe('with an error in the zip file header', function() {
      beforeEach(function(done) {
        this.yauzl.open = sinon
          .stub()
          .callsArgWith(2, new Errors.InvalidError('invalid_zip_file'))
        return this.ArchiveManager.extractZipArchive(
          this.source,
          this.destination,
          error => {
            this.callback(error)
            return done()
          }
        )
      })

      it('should return the callback with an error', function() {
        return sinon.assert.calledWithExactly(
          this.callback,
          new Errors.InvalidError('invalid_zip_file')
        )
      })

      it('should log out the error', function() {
        return this.logger.warn.called.should.equal(true)
      })
    })

    describe('with a zip that is too large', function() {
      beforeEach(function(done) {
        this.ArchiveManager._isZipTooLarge = sinon
          .stub()
          .callsArgWith(1, null, true)
        return this.ArchiveManager.extractZipArchive(
          this.source,
          this.destination,
          error => {
            this.callback(error)
            return done()
          }
        )
      })

      it('should return the callback with an error', function() {
        return sinon.assert.calledWithExactly(
          this.callback,
          new Errors.InvalidError('zip_contents_too_large')
        )
      })

      it('should not call yauzl.open', function() {
        return this.yauzl.open.called.should.equal(false)
      })
    })

    describe('with an error in the extracted files', function() {
      beforeEach(function(done) {
        this.ArchiveManager.extractZipArchive(
          this.source,
          this.destination,
          error => {
            this.callback(error)
            return done()
          }
        )
        return this.zipfile.emit('error', new Error('Something went wrong'))
      })

      it('should return the callback with an error', function() {
        return this.callback
          .calledWithExactly(new Error('Something went wrong'))
          .should.equal(true)
      })

      it('should log out the error', function() {
        return this.logger.warn.called.should.equal(true)
      })
    })

    describe('with a relative extracted file path', function() {
      beforeEach(function(done) {
        this.zipfile.openReadStream = sinon.stub()
        this.ArchiveManager.extractZipArchive(
          this.source,
          this.destination,
          error => {
            this.callback(error)
            return done()
          }
        )
        this.zipfile.emit('entry', { fileName: '../testfile.txt' })
        return this.zipfile.emit('end')
      })

      it('should not write try to read the file entry', function() {
        return this.zipfile.openReadStream.called.should.equal(false)
      })

      it('should log out a warning', function() {
        return this.logger.warn.called.should.equal(true)
      })
    })

    describe('with an unnormalized extracted file path', function() {
      beforeEach(function(done) {
        this.zipfile.openReadStream = sinon.stub()
        this.ArchiveManager.extractZipArchive(
          this.source,
          this.destination,
          error => {
            this.callback(error)
            return done()
          }
        )
        this.zipfile.emit('entry', { fileName: 'foo/./testfile.txt' })
        return this.zipfile.emit('end')
      })

      it('should not try to read the file entry', function() {
        return this.zipfile.openReadStream.called.should.equal(false)
      })

      it('should log out a warning', function() {
        return this.logger.warn.called.should.equal(true)
      })
    })

    describe('with backslashes in the path', function() {
      beforeEach(function(done) {
        this.readStream = new events.EventEmitter()
        this.readStream.pipe = sinon.stub()
        this.writeStream = new events.EventEmitter()
        this.fs.createWriteStream = sinon.stub().returns(this.writeStream)
        this.zipfile.openReadStream = sinon
          .stub()
          .callsArgWith(1, null, this.readStream)
        this.fse.ensureDir = sinon.stub().callsArg(1)
        this.ArchiveManager.extractZipArchive(
          this.source,
          this.destination,
          error => {
            this.callback(error)
            return done()
          }
        )
        this.zipfile.emit('entry', { fileName: 'wombat\\foo.tex' })
        this.zipfile.emit('entry', { fileName: 'potato\\bar.tex' })
        return this.zipfile.emit('end')
      })

      it('should read the file entry with its original path', function() {
        this.zipfile.openReadStream.should.be.calledWith({
          fileName: 'wombat\\foo.tex'
        })
        return this.zipfile.openReadStream.should.be.calledWith({
          fileName: 'potato\\bar.tex'
        })
      })

      it('should treat the backslashes as a directory separator when creating the directory', function() {
        this.fse.ensureDir.should.be.calledWith(`${this.destination}/wombat`)
        return this.fse.ensureDir.should.be.calledWith(
          `${this.destination}/potato`
        )
      })

      it('should treat the backslashes as a directory separator when creating the file', function() {
        this.fs.createWriteStream.should.be.calledWith(
          `${this.destination}/wombat/foo.tex`
        )
        return this.fs.createWriteStream.should.be.calledWith(
          `${this.destination}/potato/bar.tex`
        )
      })
    })

    describe('with a directory entry', function() {
      beforeEach(function(done) {
        this.zipfile.openReadStream = sinon.stub()
        this.ArchiveManager.extractZipArchive(
          this.source,
          this.destination,
          error => {
            this.callback(error)
            return done()
          }
        )
        this.zipfile.emit('entry', { fileName: 'testdir/' })
        return this.zipfile.emit('end')
      })

      it('should not try to read the entry', function() {
        return this.zipfile.openReadStream.called.should.equal(false)
      })
    })

    describe('with an error opening the file read stream', function() {
      beforeEach(function(done) {
        this.zipfile.openReadStream = sinon
          .stub()
          .callsArgWith(1, new Error('Something went wrong'))
        this.writeStream = new events.EventEmitter()
        this.ArchiveManager.extractZipArchive(
          this.source,
          this.destination,
          error => {
            this.callback(error)
            return done()
          }
        )
        this.zipfile.emit('entry', { fileName: 'testfile.txt' })
        return this.zipfile.emit('end')
      })

      it('should return the callback with an error', function() {
        return this.callback
          .calledWithExactly(new Error('Something went wrong'))
          .should.equal(true)
      })

      it('should log out the error', function() {
        return this.logger.warn.called.should.equal(true)
      })

      it('should close the zipfile', function() {
        return this.zipfile.close.called.should.equal(true)
      })
    })

    describe('with an error in the file read stream', function() {
      beforeEach(function(done) {
        this.readStream = new events.EventEmitter()
        this.readStream.pipe = sinon.stub()
        this.zipfile.openReadStream = sinon
          .stub()
          .callsArgWith(1, null, this.readStream)
        this.writeStream = new events.EventEmitter()
        this.fs.createWriteStream = sinon.stub().returns(this.writeStream)
        this.fse.ensureDir = sinon.stub().callsArg(1)
        this.ArchiveManager.extractZipArchive(
          this.source,
          this.destination,
          error => {
            this.callback(error)
            return done()
          }
        )
        this.zipfile.emit('entry', { fileName: 'testfile.txt' })
        this.readStream.emit('error', new Error('Something went wrong'))
        return this.zipfile.emit('end')
      })

      it('should return the callback with an error', function() {
        return this.callback
          .calledWithExactly(new Error('Something went wrong'))
          .should.equal(true)
      })

      it('should log out the error', function() {
        return this.logger.warn.called.should.equal(true)
      })

      it('should close the zipfile', function() {
        return this.zipfile.close.called.should.equal(true)
      })
    })

    describe('with an error in the file write stream', function() {
      beforeEach(function(done) {
        this.readStream = new events.EventEmitter()
        this.readStream.pipe = sinon.stub()
        this.readStream.unpipe = sinon.stub()
        this.readStream.destroy = sinon.stub()
        this.zipfile.openReadStream = sinon
          .stub()
          .callsArgWith(1, null, this.readStream)
        this.writeStream = new events.EventEmitter()
        this.fs.createWriteStream = sinon.stub().returns(this.writeStream)
        this.fse.ensureDir = sinon.stub().callsArg(1)
        this.ArchiveManager.extractZipArchive(
          this.source,
          this.destination,
          error => {
            this.callback(error)
            return done()
          }
        )
        this.zipfile.emit('entry', { fileName: 'testfile.txt' })
        this.writeStream.emit('error', new Error('Something went wrong'))
        return this.zipfile.emit('end')
      })

      it('should return the callback with an error', function() {
        return this.callback
          .calledWithExactly(new Error('Something went wrong'))
          .should.equal(true)
      })

      it('should log out the error', function() {
        return this.logger.warn.called.should.equal(true)
      })

      it('should unpipe from the readstream', function() {
        return this.readStream.unpipe.called.should.equal(true)
      })

      it('should destroy the readstream', function() {
        return this.readStream.destroy.called.should.equal(true)
      })

      it('should close the zipfile', function() {
        return this.zipfile.close.called.should.equal(true)
      })
    })
  })

  describe('_isZipTooLarge', function() {
    it('should return false with small output', function(done) {
      this.ArchiveManager._isZipTooLarge(this.source, (error, isTooLarge) => {
        isTooLarge.should.equal(false)
        return done()
      })
      this.zipfile.emit('entry', { uncompressedSize: 109042 })
      return this.zipfile.emit('end')
    })

    it('should return true with large bytes', function(done) {
      this.ArchiveManager._isZipTooLarge(this.source, (error, isTooLarge) => {
        isTooLarge.should.equal(true)
        return done()
      })
      this.zipfile.emit('entry', { uncompressedSize: 1090000000000000042 })
      return this.zipfile.emit('end')
    })

    it('should return error on no data', function(done) {
      this.ArchiveManager._isZipTooLarge(this.source, (error, isTooLarge) => {
        expect(error).to.exist
        return done()
      })
      this.zipfile.emit('entry', {})
      return this.zipfile.emit('end')
    })

    it("should return error if it didn't get a number", function(done) {
      this.ArchiveManager._isZipTooLarge(this.source, (error, isTooLarge) => {
        expect(error).to.exist
        return done()
      })
      this.zipfile.emit('entry', { uncompressedSize: 'random-error' })
      return this.zipfile.emit('end')
    })

    it('should return error if there is no data', function(done) {
      this.ArchiveManager._isZipTooLarge(this.source, (error, isTooLarge) => {
        expect(error).to.exist
        return done()
      })
      return this.zipfile.emit('end')
    })
  })

  describe('findTopLevelDirectory', function() {
    beforeEach(function() {
      this.fs.readdir = sinon.stub()
      this.fs.stat = sinon.stub()
      return (this.directory = 'test/directory')
    })

    describe('with multiple files', function() {
      beforeEach(function() {
        this.fs.readdir.callsArgWith(1, null, ['multiple', 'files'])
        return this.ArchiveManager.findTopLevelDirectory(
          this.directory,
          this.callback
        )
      })

      it('should find the files in the directory', function() {
        return this.fs.readdir.calledWith(this.directory).should.equal(true)
      })

      it('should return the original directory', function() {
        return this.callback.calledWith(null, this.directory).should.equal(true)
      })
    })

    describe('with a single file (not folder)', function() {
      beforeEach(function() {
        this.fs.readdir.callsArgWith(1, null, ['foo.tex'])
        this.fs.stat.callsArgWith(1, null, {
          isDirectory() {
            return false
          }
        })
        return this.ArchiveManager.findTopLevelDirectory(
          this.directory,
          this.callback
        )
      })

      it('should check if the file is a directory', function() {
        return this.fs.stat
          .calledWith(this.directory + '/foo.tex')
          .should.equal(true)
      })

      it('should return the original directory', function() {
        return this.callback.calledWith(null, this.directory).should.equal(true)
      })
    })

    describe('with a single top-level folder', function() {
      beforeEach(function() {
        this.fs.readdir.callsArgWith(1, null, ['folder'])
        this.fs.stat.callsArgWith(1, null, {
          isDirectory() {
            return true
          }
        })
        return this.ArchiveManager.findTopLevelDirectory(
          this.directory,
          this.callback
        )
      })

      it('should check if the file is a directory', function() {
        return this.fs.stat
          .calledWith(this.directory + '/folder')
          .should.equal(true)
      })

      it('should return the child directory', function() {
        return this.callback
          .calledWith(null, this.directory + '/folder')
          .should.equal(true)
      })
    })
  })
})
