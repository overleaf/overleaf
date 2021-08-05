const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const modulePath = '../../../app/js/LocalFileWriter.js'
const SandboxedModule = require('sandboxed-module')
const { Errors } = require('@overleaf/object-persistor')
chai.use(require('sinon-chai'))

describe('LocalFileWriter', function () {
  const writeStream = 'writeStream'
  const readStream = 'readStream'
  const settings = { path: { uploadFolder: '/uploads' } }
  const fsPath = '/uploads/wombat'
  const filename = 'wombat'
  let stream, fs, LocalFileWriter

  beforeEach(function () {
    fs = {
      createWriteStream: sinon.stub().returns(writeStream),
      unlink: sinon.stub().yields(),
    }
    stream = {
      pipeline: sinon.stub().yields(),
    }

    const ObjectPersistor = { Errors }

    LocalFileWriter = SandboxedModule.require(modulePath, {
      requires: {
        fs,
        stream,
        '@overleaf/settings': settings,
        '@overleaf/metrics': {
          inc: sinon.stub(),
          Timer: sinon.stub().returns({ done: sinon.stub() }),
        },
        '@overleaf/object-persistor': ObjectPersistor,
      },
    })
  })

  describe('writeStream', function () {
    it('writes the stream to the upload folder', function (done) {
      LocalFileWriter.writeStream(readStream, filename, (err, path) => {
        expect(err).not.to.exist
        expect(fs.createWriteStream).to.have.been.calledWith(fsPath)
        expect(stream.pipeline).to.have.been.calledWith(readStream, writeStream)
        expect(path).to.equal(fsPath)
        done()
      })
    })

    describe('when there is an error', function () {
      const error = new Error('not enough ketchup')
      beforeEach(function () {
        stream.pipeline.yields(error)
      })

      it('should wrap the error', function () {
        LocalFileWriter.writeStream(readStream, filename, err => {
          expect(err).to.exist
          expect(err.cause).to.equal(error)
        })
      })

      it('should delete the temporary file', function () {
        LocalFileWriter.writeStream(readStream, filename, () => {
          expect(fs.unlink).to.have.been.calledWith(fsPath)
        })
      })
    })
  })

  describe('deleteFile', function () {
    it('should unlink the file', function (done) {
      LocalFileWriter.deleteFile(fsPath, err => {
        expect(err).not.to.exist
        expect(fs.unlink).to.have.been.calledWith(fsPath)
        done()
      })
    })

    it('should not call unlink with an empty path', function (done) {
      LocalFileWriter.deleteFile('', err => {
        expect(err).not.to.exist
        expect(fs.unlink).not.to.have.been.called
        done()
      })
    })

    it('should not throw a error if the file does not exist', function (done) {
      const error = new Error('file not found')
      error.code = 'ENOENT'
      fs.unlink = sinon.stub().yields(error)
      LocalFileWriter.deleteFile(fsPath, err => {
        expect(err).not.to.exist
        done()
      })
    })

    it('should wrap the error', function (done) {
      const error = new Error('failed to reticulate splines')
      fs.unlink = sinon.stub().yields(error)
      LocalFileWriter.deleteFile(fsPath, err => {
        expect(err).to.exist
        expect(err.cause).to.equal(error)
        done()
      })
    })
  })
})
