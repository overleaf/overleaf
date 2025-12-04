import sinon from 'sinon'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Errors } from '@overleaf/object-persistor'

const modulePath = '../../../app/js/LocalFileWriter.js'

describe('LocalFileWriter', function () {
  const writeStream = 'writeStream'
  const readStream = 'readStream'
  const settings = { path: { uploadFolder: '/uploads' } }
  const fsPath = '/uploads/wombat'
  const filename = 'wombat'
  let stream, fs, LocalFileWriter

  beforeEach(async function () {
    fs = {
      createWriteStream: sinon.stub().returns(writeStream),
      promises: {
        unlink: sinon.stub().resolves(),
      },
    }
    stream = {
      pipeline: sinon.stub().yields(),
    }

    const ObjectPersistor = { Errors }

    vi.doMock('fs', () => ({
      default: fs,
    }))

    vi.doMock('stream', () => ({
      default: stream,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: settings,
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: {
        inc: sinon.stub(),
        Timer: sinon.stub().returns({ done: sinon.stub() }),
      },
    }))

    vi.doMock('@overleaf/object-persistor', () => ObjectPersistor)

    LocalFileWriter = (await import(modulePath)).default
  })

  describe('writeStream', function () {
    it('writes the stream to the upload folder', async function () {
      await new Promise(resolve => {
        LocalFileWriter.writeStream(readStream, filename, (err, path) => {
          expect(err).not.to.exist
          expect(fs.createWriteStream).to.have.been.calledWith(fsPath)
          expect(stream.pipeline).to.have.been.calledWith(
            readStream,
            writeStream
          )
          expect(path).to.equal(fsPath)
          resolve()
        })
      })
    })

    describe('when there is an error', function () {
      const error = new Error('not enough ketchup')
      beforeEach(function () {
        stream.pipeline.yields(error)
      })

      it('should wrap the error', async function () {
        await expect(
          LocalFileWriter.promises.writeStream(readStream, filename)
        ).to.be.rejected.and.eventually.have.property('cause', error)
      })

      it('should delete the temporary file', async function () {
        await expect(LocalFileWriter.promises.writeStream(readStream, filename))
          .to.be.rejected
        expect(fs.promises.unlink).to.have.been.calledWith(fsPath)
      })
    })
  })

  describe('deleteFile', function () {
    it('should unlink the file', async function () {
      await LocalFileWriter.promises.deleteFile(fsPath)
      expect(fs.promises.unlink).to.have.been.calledWith(fsPath)
    })

    it('should not call unlink with an empty path', async function () {
      await LocalFileWriter.promises.deleteFile('')

      expect(fs.promises.unlink).not.to.have.been.called
    })

    it('should not throw a error if the file does not exist', async function () {
      const error = new Error('file not found')
      error.code = 'ENOENT'
      fs.promises.unlink = sinon.stub().rejects(error)
      await LocalFileWriter.promises.deleteFile(fsPath)
    })

    it('should wrap the error', async function () {
      const error = new Error('failed to reticulate splines')
      fs.promises.unlink = sinon.stub().rejects(error)
      await expect(
        LocalFileWriter.promises.deleteFile(fsPath)
      ).to.be.rejectedWith(Errors.WriteError)
    })
  })
})
