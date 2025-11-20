import { vi, expect } from 'vitest'
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import sinon from 'sinon'
import ArchiveErrors from '../../../../app/src/Features/Uploads/ArchiveErrors.mjs'
import events from 'node:events'

vi.mock('../../../../app/src/Features/Uploads/ArchiveErrors.js', () =>
  vi.importActual('../../../../app/src/Features/Uploads/ArchiveErrors.js')
)

const modulePath = '../../../../app/src/Features/Uploads/ArchiveManager.mjs'

describe('ArchiveManager', function () {
  beforeEach(async function (ctx) {
    let Timer
    ctx.metrics = {
      Timer: (Timer = (function () {
        Timer = class Timer {
          static initClass() {
            this.prototype.done = sinon.stub()
          }
        }
        Timer.initClass()
        return Timer
      })()),
    }
    ctx.zipfile = new events.EventEmitter()
    ctx.zipfile.readEntry = sinon.stub()
    ctx.zipfile.close = sinon.stub()

    vi.doMock('@overleaf/settings', () => ({
      default: {},
    }))

    vi.doMock('yauzl', () => ({
      default: (ctx.yauzl = {
        open: sinon.stub().callsArgWith(2, null, ctx.zipfile),
      }),
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: ctx.metrics,
    }))
    ctx.fs = { mkdir: sinon.stub().yields(), stat: sinon.stub() }
    vi.doMock('fs', () => ({
      default: ctx.fs,
    }))

    vi.doMock(
      '../../../../app/src/Features/Uploads/ArchiveErrors',
      () => ArchiveErrors
    )

    ctx.ArchiveManager = (await import(modulePath)).default
    ctx.callback = sinon.stub()
  })

  describe('extractZipArchive', function () {
    beforeEach(function (ctx) {
      ctx.source = '/path/to/zip/source.zip'
      ctx.destination = '/path/to/zip/destination'
      ctx.ArchiveManager._isZipTooLarge = sinon
        .stub()
        .callsArgWith(1, null, false)
    })

    describe('successfully', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.readStream = new events.EventEmitter()
          ctx.readStream.pipe = sinon.stub()
          ctx.zipfile.openReadStream = sinon
            .stub()
            .callsArgWith(1, null, ctx.readStream)
          ctx.writeStream = new events.EventEmitter()
          ctx.fs.createWriteStream = sinon.stub().returns(ctx.writeStream)
          ctx.ArchiveManager.extractZipArchive(
            ctx.source,
            ctx.destination,
            resolve
          )

          // entry contains a single file
          ctx.zipfile.emit('entry', { fileName: 'testfile.txt' })
          ctx.readStream.emit('end')
          ctx.zipfile.emit('end')
        })
      })

      it('should run yauzl', function (ctx) {
        ctx.yauzl.open.calledWith(ctx.source).should.equal(true)
      })

      it('should time the unzip', function (ctx) {
        ctx.metrics.Timer.prototype.done.called.should.equal(true)
      })
    })

    describe('with a zipfile containing an empty directory', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.readStream = new events.EventEmitter()
          ctx.readStream.pipe = sinon.stub()
          ctx.zipfile.openReadStream = sinon
            .stub()
            .callsArgWith(1, null, ctx.readStream)
          ctx.writeStream = new events.EventEmitter()
          ctx.fs.createWriteStream = sinon.stub().returns(ctx.writeStream)
          ctx.ArchiveManager.extractZipArchive(
            ctx.source,
            ctx.destination,
            error => {
              ctx.callback(error)
              resolve()
            }
          )

          // entry contains a single, empty directory
          ctx.zipfile.emit('entry', { fileName: 'testdir/' })
          ctx.readStream.emit('end')
          ctx.zipfile.emit('end')
        })
      })

      it('should return the callback with an error', function (ctx) {
        sinon.assert.calledWithExactly(
          ctx.callback,
          sinon.match.instanceOf(ArchiveErrors.EmptyZipFileError)
        )
      })
    })

    describe('with an empty zipfile', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.ArchiveManager.extractZipArchive(
            ctx.source,
            ctx.destination,
            error => {
              ctx.callback(error)
              resolve()
            }
          )
          ctx.zipfile.emit('end')
        })
      })

      it('should return the callback with an error', function (ctx) {
        sinon.assert.calledWithExactly(
          ctx.callback,
          sinon.match.instanceOf(ArchiveErrors.EmptyZipFileError)
        )
      })
    })

    describe('with an error in the zip file header', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.yauzl.open = sinon
            .stub()
            .callsArgWith(2, new ArchiveErrors.InvalidZipFileError())
          ctx.ArchiveManager.extractZipArchive(
            ctx.source,
            ctx.destination,
            error => {
              ctx.callback(error)
              resolve()
            }
          )
        })
      })

      it('should return the callback with an error', function (ctx) {
        sinon.assert.calledWithExactly(
          ctx.callback,
          sinon.match.instanceOf(ArchiveErrors.InvalidZipFileError)
        )
      })
    })

    describe('with a zip that is too large', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.ArchiveManager._isZipTooLarge = sinon
            .stub()
            .callsArgWith(1, null, true)
          ctx.ArchiveManager.extractZipArchive(
            ctx.source,
            ctx.destination,
            error => {
              ctx.callback(error)
              resolve()
            }
          )
        })
      })

      it('should return the callback with an error', function (ctx) {
        sinon.assert.calledWithExactly(
          ctx.callback,
          sinon.match.instanceOf(ArchiveErrors.ZipContentsTooLargeError)
        )
      })

      it('should not call yauzl.open', function (ctx) {
        ctx.yauzl.open.called.should.equal(false)
      })
    })

    describe('with an error in the extracted files', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.ArchiveManager.extractZipArchive(
            ctx.source,
            ctx.destination,
            error => {
              ctx.callback(error)
              resolve()
            }
          )
          ctx.zipfile.emit('error', new Error('Something went wrong'))
        })
      })

      it('should return the callback with an error', function (ctx) {
        return ctx.callback.should.have.been.calledWithExactly(
          sinon.match
            .instanceOf(Error)
            .and(sinon.match.has('message', 'Something went wrong'))
        )
      })
    })

    describe('with a relative extracted file path', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.zipfile.openReadStream = sinon.stub()
          ctx.ArchiveManager.extractZipArchive(
            ctx.source,
            ctx.destination,
            error => {
              ctx.callback(error)
              return resolve()
            }
          )
          ctx.zipfile.emit('entry', { fileName: '../testfile.txt' })
          return ctx.zipfile.emit('end')
        })
      })

      it('should not write try to read the file entry', function (ctx) {
        return ctx.zipfile.openReadStream.called.should.equal(false)
      })
    })

    describe('with an unnormalized extracted file path', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.zipfile.openReadStream = sinon.stub()
          ctx.ArchiveManager.extractZipArchive(
            ctx.source,
            ctx.destination,
            error => {
              ctx.callback(error)
              return resolve()
            }
          )
          ctx.zipfile.emit('entry', { fileName: 'foo/./testfile.txt' })
          return ctx.zipfile.emit('end')
        })
      })

      it('should not try to read the file entry', function (ctx) {
        return ctx.zipfile.openReadStream.called.should.equal(false)
      })
    })

    describe('with backslashes in the path', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.readStream = new events.EventEmitter()
          ctx.readStream.pipe = sinon.stub()
          ctx.writeStream = new events.EventEmitter()
          ctx.fs.createWriteStream = sinon.stub().returns(ctx.writeStream)
          ctx.zipfile.openReadStream = sinon
            .stub()
            .callsArgWith(1, null, ctx.readStream)
          ctx.ArchiveManager.extractZipArchive(
            ctx.source,
            ctx.destination,
            error => {
              ctx.callback(error)
              return resolve()
            }
          )
          ctx.zipfile.emit('entry', { fileName: 'wombat\\foo.tex' })
          ctx.zipfile.emit('entry', { fileName: 'potato\\bar.tex' })
          return ctx.zipfile.emit('end')
        })
      })

      it('should read the file entry with its original path', function (ctx) {
        ctx.zipfile.openReadStream.should.be.calledWith({
          fileName: 'wombat\\foo.tex',
        })
        ctx.zipfile.openReadStream.should.be.calledWith({
          fileName: 'potato\\bar.tex',
        })
      })

      it('should treat the backslashes as a directory separator when creating the directory', function (ctx) {
        ctx.fs.mkdir.should.be.calledWith(`${ctx.destination}/wombat`, {
          recursive: true,
        })
        ctx.fs.mkdir.should.be.calledWith(`${ctx.destination}/potato`, {
          recursive: true,
        })
      })

      it('should treat the backslashes as a directory separator when creating the file', function (ctx) {
        ctx.fs.createWriteStream.should.be.calledWith(
          `${ctx.destination}/wombat/foo.tex`
        )
        ctx.fs.createWriteStream.should.be.calledWith(
          `${ctx.destination}/potato/bar.tex`
        )
      })
    })

    describe('with a directory entry', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.zipfile.openReadStream = sinon.stub()
          ctx.ArchiveManager.extractZipArchive(
            ctx.source,
            ctx.destination,
            error => {
              ctx.callback(error)
              resolve()
            }
          )
          ctx.zipfile.emit('entry', { fileName: 'testdir/' })
          ctx.zipfile.emit('end')
        })
      })

      it('should not try to read the entry', function (ctx) {
        ctx.zipfile.openReadStream.called.should.equal(false)
      })
    })

    describe('with an error opening the file read stream', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.zipfile.openReadStream = sinon
            .stub()
            .callsArgWith(1, new Error('Something went wrong'))
          ctx.writeStream = new events.EventEmitter()
          ctx.ArchiveManager.extractZipArchive(
            ctx.source,
            ctx.destination,
            error => {
              ctx.callback(error)
              resolve()
            }
          )
          ctx.zipfile.emit('entry', { fileName: 'testfile.txt' })
          ctx.zipfile.emit('end')
        })
      })

      it('should return the callback with an error', function (ctx) {
        ctx.callback.should.have.been.calledWithExactly(
          sinon.match
            .instanceOf(Error)
            .and(sinon.match.has('message', 'Something went wrong'))
        )
      })

      it('should close the zipfile', function (ctx) {
        ctx.zipfile.close.called.should.equal(true)
      })
    })

    describe('with an error in the file read stream', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.readStream = new events.EventEmitter()
          ctx.readStream.pipe = sinon.stub()
          ctx.zipfile.openReadStream = sinon
            .stub()
            .callsArgWith(1, null, ctx.readStream)
          ctx.writeStream = new events.EventEmitter()
          ctx.fs.createWriteStream = sinon.stub().returns(ctx.writeStream)
          ctx.ArchiveManager.extractZipArchive(
            ctx.source,
            ctx.destination,
            error => {
              ctx.callback(error)
              return resolve()
            }
          )
          ctx.zipfile.emit('entry', { fileName: 'testfile.txt' })
          ctx.readStream.emit('error', new Error('Something went wrong'))
          ctx.zipfile.emit('end')
        })
      })

      it('should return the callback with an error', function (ctx) {
        ctx.callback.should.have.been.calledWithExactly(
          sinon.match
            .instanceOf(Error)
            .and(sinon.match.has('message', 'Something went wrong'))
        )
      })

      it('should close the zipfile', function (ctx) {
        ctx.zipfile.close.called.should.equal(true)
      })
    })

    describe('with an error in the file write stream', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.readStream = new events.EventEmitter()
          ctx.readStream.pipe = sinon.stub()
          ctx.readStream.unpipe = sinon.stub()
          ctx.readStream.destroy = sinon.stub()
          ctx.zipfile.openReadStream = sinon
            .stub()
            .callsArgWith(1, null, ctx.readStream)
          ctx.writeStream = new events.EventEmitter()
          ctx.fs.createWriteStream = sinon.stub().returns(ctx.writeStream)
          ctx.ArchiveManager.extractZipArchive(
            ctx.source,
            ctx.destination,
            error => {
              ctx.callback(error)
              return resolve()
            }
          )
          ctx.zipfile.emit('entry', { fileName: 'testfile.txt' })
          ctx.writeStream.emit('error', new Error('Something went wrong'))
          ctx.zipfile.emit('end')
        })
      })

      it('should return the callback with an error', function (ctx) {
        ctx.callback.should.have.been.calledWithExactly(
          sinon.match
            .instanceOf(Error)
            .and(sinon.match.has('message', 'Something went wrong'))
        )
      })

      it('should unpipe from the readstream', function (ctx) {
        ctx.readStream.unpipe.called.should.equal(true)
      })

      it('should destroy the readstream', function (ctx) {
        ctx.readStream.destroy.called.should.equal(true)
      })

      it('should close the zipfile', function (ctx) {
        ctx.zipfile.close.called.should.equal(true)
      })
    })
  })

  describe('_isZipTooLarge', function () {
    it('should return false with small output', async function (ctx) {
      await new Promise(resolve => {
        ctx.ArchiveManager._isZipTooLarge(ctx.source, (error, isTooLarge) => {
          expect(error).not.to.exist
          isTooLarge.should.equal(false)
          resolve()
        })
        ctx.zipfile.emit('entry', { uncompressedSize: 109042 })
        ctx.zipfile.emit('end')
      })
    })

    it('should return true with large bytes', async function (ctx) {
      await new Promise(resolve => {
        ctx.ArchiveManager._isZipTooLarge(ctx.source, (error, isTooLarge) => {
          expect(error).not.to.exist
          isTooLarge.should.equal(true)
          resolve()
        })
        ctx.zipfile.emit('entry', { uncompressedSize: 109e16 })
        ctx.zipfile.emit('end')
      })
    })

    it('should return error on no data', async function (ctx) {
      await new Promise(resolve => {
        ctx.ArchiveManager._isZipTooLarge(ctx.source, (error, isTooLarge) => {
          expect(error).to.exist
          resolve()
        })
        ctx.zipfile.emit('entry', {})
        ctx.zipfile.emit('end')
      })
    })

    it("should return error if it didn't get a number", async function (ctx) {
      await new Promise(resolve => {
        ctx.ArchiveManager._isZipTooLarge(ctx.source, (error, isTooLarge) => {
          expect(error).to.exist
          resolve()
        })
        ctx.zipfile.emit('entry', { uncompressedSize: 'random-error' })
        ctx.zipfile.emit('end')
      })
    })

    it('should return error if there is no data', async function (ctx) {
      await new Promise(resolve => {
        ctx.ArchiveManager._isZipTooLarge(ctx.source, (error, isTooLarge) => {
          expect(error).to.exist
          resolve()
        })
        ctx.zipfile.emit('end')
      })
    })
  })

  describe('findTopLevelDirectory', function () {
    beforeEach(function (ctx) {
      ctx.fs.readdir = sinon.stub()
      ctx.fs.stat((ctx.directory = 'test/directory'))
    })

    describe('with multiple files', function () {
      beforeEach(function (ctx) {
        ctx.fs.readdir.callsArgWith(1, null, ['multiple', 'files'])
        ctx.ArchiveManager.findTopLevelDirectory(ctx.directory, ctx.callback)
      })

      it('should find the files in the directory', function (ctx) {
        ctx.fs.readdir.calledWith(ctx.directory).should.equal(true)
      })

      it('should return the original directory', function (ctx) {
        ctx.callback.calledWith(null, ctx.directory).should.equal(true)
      })
    })

    describe('with a single file (not folder)', function () {
      beforeEach(function (ctx) {
        ctx.fs.readdir.callsArgWith(1, null, ['foo.tex'])
        ctx.fs.stat.callsArgWith(1, null, {
          isDirectory() {
            return false
          },
        })
        ctx.ArchiveManager.findTopLevelDirectory(ctx.directory, ctx.callback)
      })

      it('should check if the file is a directory', function (ctx) {
        ctx.fs.stat.calledWith(ctx.directory + '/foo.tex').should.equal(true)
      })

      it('should return the original directory', function (ctx) {
        ctx.callback.calledWith(null, ctx.directory).should.equal(true)
      })
    })

    describe('with a single top-level folder', function () {
      beforeEach(function (ctx) {
        ctx.fs.readdir.callsArgWith(1, null, ['folder'])
        ctx.fs.stat.callsArgWith(1, null, {
          isDirectory() {
            return true
          },
        })
        ctx.ArchiveManager.findTopLevelDirectory(ctx.directory, ctx.callback)
      })

      it('should check if the file is a directory', function (ctx) {
        ctx.fs.stat.calledWith(ctx.directory + '/folder').should.equal(true)
      })

      it('should return the child directory', function (ctx) {
        ctx.callback
          .calledWith(null, ctx.directory + '/folder')
          .should.equal(true)
      })
    })
  })
})
