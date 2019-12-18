const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const modulePath = '../../../app/js/LocalFileWriter.js'
const SandboxedModule = require('sandboxed-module')
chai.use(require('sinon-chai'))

describe('LocalFileWriter', function() {
  const writeStream = 'writeStream'
  const readStream = 'readStream'
  const settings = { path: { uploadFolder: '/uploads' } }
  const fsPath = '/uploads/wombat'
  const filename = 'wombat'
  let stream, fs, LocalFileWriter

  beforeEach(function() {
    fs = {
      createWriteStream: sinon.stub().returns(writeStream),
      unlink: sinon.stub().yields()
    }
    stream = {
      pipeline: sinon.stub().yields()
    }

    LocalFileWriter = SandboxedModule.require(modulePath, {
      requires: {
        fs,
        stream,
        'logger-sharelatex': {
          log() {},
          err() {}
        },
        'settings-sharelatex': settings,
        'metrics-sharelatex': {
          inc: sinon.stub(),
          Timer: sinon.stub().returns({ done: sinon.stub() })
        }
      }
    })
  })

  describe('writeStream', function() {
    it('writes the stream to the upload folder', function(done) {
      LocalFileWriter.writeStream(readStream, filename, (err, path) => {
        expect(err).not.to.exist
        expect(fs.createWriteStream).to.have.been.calledWith(fsPath)
        expect(stream.pipeline).to.have.been.calledWith(readStream, writeStream)
        expect(path).to.equal(fsPath)
        done()
      })
    })
  })

  describe('deleteFile', function() {
    it('should unlink the file', function(done) {
      LocalFileWriter.deleteFile(fsPath, err => {
        expect(err).not.to.exist
        expect(fs.unlink).to.have.been.calledWith(fsPath)
        done()
      })
    })

    it('should not do anything if called with an empty path', function(done) {
      fs.unlink = sinon.stub().yields(new Error('failed to reticulate splines'))
      LocalFileWriter.deleteFile(fsPath, err => {
        expect(err).to.exist
        done()
      })
    })

    it('should not call unlink with an empty path', function(done) {
      LocalFileWriter.deleteFile('', err => {
        expect(err).not.to.exist
        expect(fs.unlink).not.to.have.been.called
        done()
      })
    })
  })
})
