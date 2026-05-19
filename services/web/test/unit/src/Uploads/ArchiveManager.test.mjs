import { vi, expect } from 'vitest'
import sinon from 'sinon'
import ArchiveErrors from '../../../../app/src/Features/Uploads/ArchiveErrors.mjs'
import events from 'node:events'
import { PassThrough } from 'node:stream'

vi.mock('../../../../app/src/Features/Uploads/ArchiveErrors.js', () =>
  vi.importActual('../../../../app/src/Features/Uploads/ArchiveErrors.js')
)

const modulePath = '../../../../app/src/Features/Uploads/ArchiveManager.mjs'

describe('ArchiveManager', function () {
  beforeEach(async function (ctx) {
    ctx.metrics = {
      Timer: class Timer {},
    }
    ctx.metrics.Timer.prototype.done = sinon.stub()
    ctx.zipfile = new events.EventEmitter()
    ctx.zipfile.readEntry = sinon.stub()
    ctx.zipfile.close = sinon.stub()

    ctx.Settings = {}
    vi.doMock('@overleaf/settings', () => ({
      default: ctx.Settings,
    }))

    vi.doMock('yauzl', () => ({
      default: (ctx.yauzl = {
        open: sinon.stub().callsArgWith(2, null, ctx.zipfile),
      }),
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: ctx.metrics,
    }))
    ctx.fs = { mkdir: sinon.stub().yields() }
    vi.doMock('fs', () => ({
      default: ctx.fs,
    }))

    ctx.fsPromises = {
      readdir: sinon.stub(),
      stat: sinon.stub(),
    }
    vi.doMock('fs/promises', () => ({
      default: ctx.fsPromises,
    }))

    vi.doMock(
      '../../../../app/src/Features/Uploads/ArchiveErrors',
      () => ArchiveErrors
    )

    ctx.FileTypeManager = {
      shouldIgnore: sinon.stub().returns(false),
    }
    vi.doMock(
      '../../../../app/src/Features/Uploads/FileTypeManager.mjs',
      () => ({ default: ctx.FileTypeManager })
    )

    ctx.ArchiveManager = (await import(modulePath)).default
  })

  describe('extractZipArchive', function () {
    beforeEach(function (ctx) {
      ctx.source = '/path/to/zip/source.zip'
      ctx.destination = '/path/to/zip/destination'
      ctx.ArchiveManager._isZipTooLarge = sinon.stub().resolves(false)
    })

    describe('successfully', function () {
      beforeEach(async function (ctx) {
        ctx.readStream = new PassThrough()
        ctx.zipfile.openReadStream = sinon
          .stub()
          .callsArgWith(1, null, ctx.readStream)
        ctx.writeStream = new PassThrough()
        ctx.fs.createWriteStream = sinon.stub().returns(ctx.writeStream)
        sinon.spy(ctx.writeStream, 'destroy')

        const promise = ctx.ArchiveManager.promises.extractZipArchive(
          ctx.source,
          ctx.destination
        )
        await Promise.resolve()

        // entry contains a single file
        ctx.zipfile.emit('entry', { fileName: 'testfile.txt' })
        ctx.readStream.end()
        // flush pipeline callback (fires via nextTick)
        await new Promise(resolve => process.nextTick(resolve))
        ctx.zipfile.emit('end')
        await promise
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
        ctx.readStream = new PassThrough()
        ctx.zipfile.openReadStream = sinon
          .stub()
          .callsArgWith(1, null, ctx.readStream)
        ctx.writeStream = new PassThrough()
        ctx.fs.createWriteStream = sinon.stub().returns(ctx.writeStream)
        sinon.spy(ctx.writeStream, 'destroy')

        const promise = ctx.ArchiveManager.promises.extractZipArchive(
          ctx.source,
          ctx.destination
        )
        await Promise.resolve()

        // entry contains a single, empty directory
        ctx.zipfile.emit('entry', { fileName: 'testdir/' })
        ctx.readStream.end()
        ctx.zipfile.emit('end')

        try {
          await promise
        } catch (error) {
          ctx.error = error
        }
      })

      it('should reject with an EmptyZipFileError', function (ctx) {
        expect(ctx.error).to.be.instanceOf(ArchiveErrors.EmptyZipFileError)
      })
    })

    describe('with an empty zipfile', function () {
      beforeEach(async function (ctx) {
        const promise = ctx.ArchiveManager.promises.extractZipArchive(
          ctx.source,
          ctx.destination
        )
        await Promise.resolve()
        ctx.zipfile.emit('end')

        try {
          await promise
        } catch (error) {
          ctx.error = error
        }
      })

      it('should reject with an EmptyZipFileError', function (ctx) {
        expect(ctx.error).to.be.instanceOf(ArchiveErrors.EmptyZipFileError)
      })
    })

    describe('with an error in the zip file header', function () {
      beforeEach(async function (ctx) {
        ctx.yauzl.open = sinon
          .stub()
          .callsArgWith(2, new ArchiveErrors.InvalidZipFileError())

        try {
          await ctx.ArchiveManager.promises.extractZipArchive(
            ctx.source,
            ctx.destination
          )
        } catch (error) {
          ctx.error = error
        }
      })

      it('should reject with an error', function (ctx) {
        expect(ctx.error).to.be.instanceOf(ArchiveErrors.InvalidZipFileError)
      })
    })

    describe('with a zip that is too large', function () {
      beforeEach(async function (ctx) {
        ctx.ArchiveManager._isZipTooLarge = sinon.stub().resolves(true)

        try {
          await ctx.ArchiveManager.promises.extractZipArchive(
            ctx.source,
            ctx.destination
          )
        } catch (error) {
          ctx.error = error
        }
      })

      it('should reject with a ZipContentsTooLargeError', function (ctx) {
        expect(ctx.error).to.be.instanceOf(
          ArchiveErrors.ZipContentsTooLargeError
        )
      })

      it('should not call yauzl.open', function (ctx) {
        ctx.yauzl.open.called.should.equal(false)
      })
    })

    describe('with an error in the extracted files', function () {
      beforeEach(async function (ctx) {
        const promise = ctx.ArchiveManager.promises.extractZipArchive(
          ctx.source,
          ctx.destination
        )
        await Promise.resolve()
        ctx.zipfile.emit('error', new Error('Something went wrong'))

        try {
          await promise
        } catch (error) {
          ctx.error = error
        }
      })

      it('should reject with an error', function (ctx) {
        expect(ctx.error)
          .to.be.instanceOf(Error)
          .and.have.property('message', 'Something went wrong')
      })
    })

    describe('with a relative extracted file path', function () {
      beforeEach(async function (ctx) {
        ctx.zipfile.openReadStream = sinon.stub()

        const promise = ctx.ArchiveManager.promises.extractZipArchive(
          ctx.source,
          ctx.destination
        )
        await Promise.resolve()

        ctx.zipfile.emit('entry', { fileName: '../testfile.txt' })
        ctx.zipfile.emit('end')

        try {
          await promise
        } catch (error) {
          ctx.error = error
        }
      })

      it('should not try to read the file entry', function (ctx) {
        ctx.zipfile.openReadStream.called.should.equal(false)
      })
    })

    describe('with an unnormalized extracted file path', function () {
      beforeEach(async function (ctx) {
        ctx.zipfile.openReadStream = sinon.stub()

        const promise = ctx.ArchiveManager.promises.extractZipArchive(
          ctx.source,
          ctx.destination
        )
        await Promise.resolve()

        ctx.zipfile.emit('entry', { fileName: 'foo/./testfile.txt' })
        ctx.zipfile.emit('end')

        try {
          await promise
        } catch (error) {
          ctx.error = error
        }
      })

      it('should not try to read the file entry', function (ctx) {
        ctx.zipfile.openReadStream.called.should.equal(false)
      })
    })

    describe('with backslashes in the path', function () {
      beforeEach(async function (ctx) {
        ctx.readStream = new PassThrough()
        ctx.writeStream = new PassThrough()
        ctx.fs.createWriteStream = sinon.stub().returns(ctx.writeStream)
        sinon.spy(ctx.writeStream, 'destroy')
        ctx.zipfile.openReadStream = sinon
          .stub()
          .callsArgWith(1, null, ctx.readStream)

        const promise = ctx.ArchiveManager.promises.extractZipArchive(
          ctx.source,
          ctx.destination
        )
        await Promise.resolve()

        ctx.zipfile.emit('entry', { fileName: 'wombat\\foo.tex' })
        ctx.readStream.end()
        ctx.zipfile.emit('entry', { fileName: 'potato\\bar.tex' })
        ctx.readStream.end()
        ctx.zipfile.emit('end')
        // Pipeline doesn't complete in this test (shared streams);
        // we only verify method call arguments, so swallow the rejection.
        await promise.catch(() => {})
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
        ctx.zipfile.openReadStream = sinon.stub()

        const promise = ctx.ArchiveManager.promises.extractZipArchive(
          ctx.source,
          ctx.destination
        )
        await Promise.resolve()

        ctx.zipfile.emit('entry', { fileName: 'testdir/' })
        ctx.zipfile.emit('end')

        try {
          await promise
        } catch (error) {
          ctx.error = error
        }
      })

      it('should not try to read the entry', function (ctx) {
        ctx.zipfile.openReadStream.called.should.equal(false)
      })
    })

    describe('with an entry that FileTypeManager wants ignored', function () {
      beforeEach(async function (ctx) {
        ctx.FileTypeManager.shouldIgnore
          .withArgs('__MACOSX/project/._file.tex')
          .returns(true)

        ctx.readStream = new PassThrough()
        ctx.zipfile.openReadStream = sinon
          .stub()
          .callsArgWith(1, null, ctx.readStream)
        ctx.writeStream = new PassThrough()
        ctx.fs.createWriteStream = sinon.stub().returns(ctx.writeStream)

        const promise = ctx.ArchiveManager.promises.extractZipArchive(
          ctx.source,
          ctx.destination
        )
        await Promise.resolve()

        ctx.zipfile.emit('entry', { fileName: 'project/file.tex' })
        ctx.readStream.end()
        await new Promise(resolve => process.nextTick(resolve))
        ctx.zipfile.emit('entry', {
          fileName: '__MACOSX/project/._file.tex',
        })
        ctx.zipfile.emit('end')
        await promise
      })

      it('should not open a read stream for the ignored entry', function (ctx) {
        ctx.zipfile.openReadStream.callCount.should.equal(1)
        ctx.zipfile.openReadStream.firstCall.args[0].should.deep.equal({
          fileName: 'project/file.tex',
        })
      })
    })

    describe('with an error opening the file read stream', function () {
      beforeEach(async function (ctx) {
        ctx.zipfile.openReadStream = sinon
          .stub()
          .callsArgWith(1, new Error('Something went wrong'))
        ctx.writeStream = new PassThrough()

        const promise = ctx.ArchiveManager.promises.extractZipArchive(
          ctx.source,
          ctx.destination
        )
        await Promise.resolve()

        ctx.zipfile.emit('entry', { fileName: 'testfile.txt' })
        ctx.zipfile.emit('end')

        try {
          await promise
        } catch (error) {
          ctx.error = error
        }
      })

      it('should reject with an error', function (ctx) {
        expect(ctx.error)
          .to.be.instanceOf(Error)
          .and.have.property('message', 'invalid_zip_file')
      })

      it('should close the zipfile', function (ctx) {
        ctx.zipfile.close.called.should.equal(true)
      })
    })

    describe('with an error in the file read stream', function () {
      beforeEach(async function (ctx) {
        ctx.readStream = new PassThrough()
        ctx.zipfile.openReadStream = sinon
          .stub()
          .callsArgWith(1, null, ctx.readStream)
        ctx.writeStream = new PassThrough()
        ctx.fs.createWriteStream = sinon.stub().returns(ctx.writeStream)
        sinon.spy(ctx.writeStream, 'destroy')

        const promise = ctx.ArchiveManager.promises.extractZipArchive(
          ctx.source,
          ctx.destination
        )
        await Promise.resolve()

        ctx.zipfile.emit('entry', { fileName: 'testfile.txt' })
        ctx.readStream.emit('error', new Error('Something went wrong'))

        try {
          await promise
        } catch (error) {
          ctx.error = error
        }
      })

      it('should reject with an error', function (ctx) {
        expect(ctx.error)
          .to.be.instanceOf(Error)
          .and.have.property('message', 'invalid_zip_file')
      })

      it('should close the zipfile', function (ctx) {
        ctx.zipfile.close.called.should.equal(true)
      })
    })

    describe('with an error in the file write stream', function () {
      beforeEach(async function (ctx) {
        ctx.readStream = new PassThrough()
        sinon.spy(ctx.readStream, 'destroy')
        ctx.zipfile.openReadStream = sinon
          .stub()
          .callsArgWith(1, null, ctx.readStream)
        ctx.writeStream = new PassThrough()
        ctx.fs.createWriteStream = sinon.stub().returns(ctx.writeStream)
        sinon.spy(ctx.writeStream, 'destroy')

        const promise = ctx.ArchiveManager.promises.extractZipArchive(
          ctx.source,
          ctx.destination
        )
        await Promise.resolve()

        ctx.zipfile.emit('entry', { fileName: 'testfile.txt' })
        ctx.writeStream.emit('error', new Error('Something went wrong'))

        try {
          await promise
        } catch (error) {
          ctx.error = error
        }
      })

      it('should reject with an error', function (ctx) {
        expect(ctx.error)
          .to.be.instanceOf(Error)
          .and.have.property('message', 'invalid_zip_file')
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
      const promise = ctx.ArchiveManager._isZipTooLarge(ctx.source)
      ctx.zipfile.emit('entry', { uncompressedSize: 109042 })
      ctx.zipfile.emit('end')
      const isTooLarge = await promise
      isTooLarge.should.equal(false)
    })

    it('should return true with large bytes', async function (ctx) {
      const promise = ctx.ArchiveManager._isZipTooLarge(ctx.source)
      ctx.zipfile.emit('entry', { uncompressedSize: 109e16 })
      ctx.zipfile.emit('end')
      const isTooLarge = await promise
      isTooLarge.should.equal(true)
    })

    it('should return error on no data', async function (ctx) {
      const promise = ctx.ArchiveManager._isZipTooLarge(ctx.source)
      ctx.zipfile.emit('entry', {})
      ctx.zipfile.emit('end')
      await expect(promise).to.be.rejectedWith(
        ArchiveErrors.InvalidZipFileError
      )
    })

    it("should return error if it didn't get a number", async function (ctx) {
      const promise = ctx.ArchiveManager._isZipTooLarge(ctx.source)
      ctx.zipfile.emit('entry', { uncompressedSize: 'random-error' })
      ctx.zipfile.emit('end')
      await expect(promise).to.be.rejectedWith(
        ArchiveErrors.InvalidZipFileError
      )
    })

    it('should return error if there is no data', async function (ctx) {
      const promise = ctx.ArchiveManager._isZipTooLarge(ctx.source)
      ctx.zipfile.emit('end')
      await expect(promise).to.be.rejectedWith(
        ArchiveErrors.InvalidZipFileError
      )
    })

    it('should reject upfront when entryCount far exceeds the limit', async function (ctx) {
      ctx.Settings.maxEntitiesPerProject = 10
      ctx.zipfile.entryCount = 1_000_000_000
      const isTooLarge = await ctx.ArchiveManager._isZipTooLarge(ctx.source)
      isTooLarge.should.equal(true)
      ctx.zipfile.readEntry.called.should.equal(false)
      ctx.zipfile.close.called.should.equal(true)
    })

    it('should not reject a __MACOSX-padded zip whose real entry count is within the limit', async function (ctx) {
      ctx.Settings.maxEntitiesPerProject = 10
      ctx.FileTypeManager.shouldIgnore.callsFake(name =>
        name.startsWith('__MACOSX/')
      )
      const promise = ctx.ArchiveManager._isZipTooLarge(ctx.source)
      for (let i = 0; i < 6; i++) {
        ctx.zipfile.emit('entry', {
          fileName: `project/file-${i}.tex`,
          uncompressedSize: 100,
        })
      }
      ctx.zipfile.emit('entry', {
        fileName: '__MACOSX/',
        uncompressedSize: 0,
      })
      ctx.zipfile.emit('entry', {
        fileName: '__MACOSX/project/',
        uncompressedSize: 0,
      })
      for (let i = 0; i < 6; i++) {
        ctx.zipfile.emit('entry', {
          fileName: `__MACOSX/project/._file-${i}.tex`,
          uncompressedSize: 200,
        })
      }
      ctx.zipfile.emit('end')
      const isTooLarge = await promise
      isTooLarge.should.equal(false)
    })

    it('should reject and stop iterating once the limit is exceeded', async function (ctx) {
      ctx.Settings.maxEntitiesPerProject = 3
      const promise = ctx.ArchiveManager._isZipTooLarge(ctx.source)
      for (let i = 0; i < 4; i++) {
        ctx.zipfile.emit('entry', {
          fileName: `file-${i}.tex`,
          uncompressedSize: 100,
        })
      }
      const isTooLarge = await promise
      isTooLarge.should.equal(true)
      ctx.zipfile.close.called.should.equal(true)
      // 3 readEntry()s for the first three entries, none after the 4th bails
      ctx.zipfile.readEntry.callCount.should.equal(4)
    })

    it('should ignore __MACOSX bytes when computing total size', async function (ctx) {
      ctx.FileTypeManager.shouldIgnore
        .withArgs('__MACOSX/._file.tex')
        .returns(true)
      const promise = ctx.ArchiveManager._isZipTooLarge(ctx.source)
      ctx.zipfile.emit('entry', {
        fileName: 'file.tex',
        uncompressedSize: 100,
      })
      // Huge AppleDouble entry that would otherwise trip the size check.
      ctx.zipfile.emit('entry', {
        fileName: '__MACOSX/._file.tex',
        uncompressedSize: 109e16,
      })
      ctx.zipfile.emit('end')
      const isTooLarge = await promise
      isTooLarge.should.equal(false)
    })
  })

  describe('findTopLevelDirectory', function () {
    beforeEach(function (ctx) {
      ctx.directory = 'test/directory'
    })

    describe('with multiple files', function () {
      beforeEach(async function (ctx) {
        ctx.fsPromises.readdir.resolves(['multiple', 'files'])
        ctx.result = await ctx.ArchiveManager.promises.findTopLevelDirectory(
          ctx.directory
        )
      })

      it('should find the files in the directory', function (ctx) {
        ctx.fsPromises.readdir.calledWith(ctx.directory).should.equal(true)
      })

      it('should return the original directory', function (ctx) {
        ctx.result.should.equal(ctx.directory)
      })
    })

    describe('with a single file (not folder)', function () {
      beforeEach(async function (ctx) {
        ctx.fsPromises.readdir.resolves(['foo.tex'])
        ctx.fsPromises.stat.resolves({
          isDirectory() {
            return false
          },
        })
        ctx.result = await ctx.ArchiveManager.promises.findTopLevelDirectory(
          ctx.directory
        )
      })

      it('should check if the file is a directory', function (ctx) {
        ctx.fsPromises.stat
          .calledWith(ctx.directory + '/foo.tex')
          .should.equal(true)
      })

      it('should return the original directory', function (ctx) {
        ctx.result.should.equal(ctx.directory)
      })
    })

    describe('with a single top-level folder', function () {
      beforeEach(async function (ctx) {
        ctx.fsPromises.readdir.resolves(['folder'])
        ctx.fsPromises.stat.resolves({
          isDirectory() {
            return true
          },
        })
        ctx.result = await ctx.ArchiveManager.promises.findTopLevelDirectory(
          ctx.directory
        )
      })

      it('should check if the file is a directory', function (ctx) {
        ctx.fsPromises.stat
          .calledWith(ctx.directory + '/folder')
          .should.equal(true)
      })

      it('should return the child directory', function (ctx) {
        ctx.result.should.equal(ctx.directory + '/folder')
      })
    })
  })
})
