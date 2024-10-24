const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const modulePath = '../../../app/js/FileHandler.js'
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb')
const { Errors } = require('@overleaf/object-persistor')

chai.use(require('sinon-chai'))
chai.use(require('chai-as-promised'))

describe('FileHandler', function () {
  let PersistorManager,
    LocalFileWriter,
    FileConverter,
    KeyBuilder,
    ImageOptimiser,
    FileHandler,
    Settings,
    fs

  const bucket = 'my_bucket'
  const key = `${new ObjectId()}/${new ObjectId()}`
  const convertedFolderKey = `${new ObjectId()}/${new ObjectId()}`
  const projectKey = `${new ObjectId()}/`
  const sourceStream = 'sourceStream'
  const convertedKey = 'convertedKey'
  const redirectUrl = 'https://wombat.potato/giraffe'
  const readStream = {
    stream: 'readStream',
    on: sinon.stub(),
  }

  beforeEach(function () {
    PersistorManager = {
      getObjectStream: sinon.stub().resolves(sourceStream),
      getRedirectUrl: sinon.stub().resolves(redirectUrl),
      checkIfObjectExists: sinon.stub().resolves(),
      deleteObject: sinon.stub().resolves(),
      deleteDirectory: sinon.stub().resolves(),
      sendStream: sinon.stub().resolves(),
      insertFile: sinon.stub().resolves(),
      sendFile: sinon.stub().resolves(),
      directorySize: sinon.stub().resolves(),
    }
    LocalFileWriter = {
      // the callback style is used for detached cleanup calls
      deleteFile: sinon.stub().yields(),
      promises: {
        writeStream: sinon.stub().resolves(),
        deleteFile: sinon.stub().resolves(),
      },
    }
    FileConverter = {
      promises: {
        convert: sinon.stub().resolves(),
        thumbnail: sinon.stub().resolves(),
        preview: sinon.stub().resolves(),
      },
    }
    KeyBuilder = {
      addCachingToKey: sinon.stub().returns(convertedKey),
      getConvertedFolderKey: sinon.stub().returns(convertedFolderKey),
    }
    ImageOptimiser = {
      promises: {
        compressPng: sinon.stub().resolves(),
      },
    }
    Settings = {
      filestore: {
        stores: { template_files: 'template_files', user_files: 'user_files' },
      },
    }
    fs = {
      createReadStream: sinon.stub().returns(readStream),
    }

    const ObjectPersistor = { Errors }

    FileHandler = SandboxedModule.require(modulePath, {
      requires: {
        './PersistorManager': PersistorManager,
        './LocalFileWriter': LocalFileWriter,
        './FileConverter': FileConverter,
        './KeyBuilder': KeyBuilder,
        './ImageOptimiser': ImageOptimiser,
        '@overleaf/settings': Settings,
        '@overleaf/object-persistor': ObjectPersistor,
        '@overleaf/metrics': {
          gauge: sinon.stub(),
          Timer: sinon.stub().returns({ done: sinon.stub() }),
        },
        fs,
      },
      globals: { console, process },
    })
  })

  describe('insertFile', function () {
    const stream = 'stream'

    it('should send file to the filestore', function (done) {
      FileHandler.insertFile(bucket, key, stream, err => {
        expect(err).not.to.exist
        expect(PersistorManager.sendStream).to.have.been.calledWith(
          bucket,
          key,
          stream
        )
        done()
      })
    })

    it('should not make a delete request for the convertedKey folder', function (done) {
      FileHandler.insertFile(bucket, key, stream, err => {
        expect(err).not.to.exist
        expect(PersistorManager.deleteDirectory).not.to.have.been.called
        done()
      })
    })

    it('should accept templates-api key format', function (done) {
      KeyBuilder.getConvertedFolderKey.returns(
        '5ecba29f1a294e007d0bccb4/v/0/pdf'
      )
      FileHandler.insertFile(bucket, key, stream, err => {
        expect(err).not.to.exist
        done()
      })
    })

    it('should throw an error when the key is in the wrong format', function (done) {
      KeyBuilder.getConvertedFolderKey.returns('wombat')
      FileHandler.insertFile(bucket, key, stream, err => {
        expect(err).to.exist
        done()
      })
    })
  })

  describe('deleteFile', function () {
    it('should tell the filestore manager to delete the file', function (done) {
      FileHandler.deleteFile(bucket, key, err => {
        expect(err).not.to.exist
        expect(PersistorManager.deleteObject).to.have.been.calledWith(
          bucket,
          key
        )
        done()
      })
    })

    it('should not tell the filestore manager to delete the cached folder', function (done) {
      FileHandler.deleteFile(bucket, key, err => {
        expect(err).not.to.exist
        expect(PersistorManager.deleteDirectory).not.to.have.been.called
        done()
      })
    })

    it('should accept templates-api key format', function (done) {
      KeyBuilder.getConvertedFolderKey.returns(
        '5ecba29f1a294e007d0bccb4/v/0/pdf'
      )
      FileHandler.deleteFile(bucket, key, err => {
        expect(err).not.to.exist
        done()
      })
    })

    it('should throw an error when the key is in the wrong format', function (done) {
      KeyBuilder.getConvertedFolderKey.returns('wombat')
      FileHandler.deleteFile(bucket, key, err => {
        expect(err).to.exist
        done()
      })
    })

    describe('when conversions are enabled', function () {
      beforeEach(function () {
        Settings.enableConversions = true
      })

      it('should delete the convertedKey folder for template files', function (done) {
        FileHandler.deleteFile(
          Settings.filestore.stores.template_files,
          key,
          err => {
            expect(err).not.to.exist
            expect(PersistorManager.deleteDirectory).to.have.been.calledWith(
              Settings.filestore.stores.template_files,
              convertedFolderKey
            )
            done()
          }
        )
      })

      it('should not delete the convertedKey folder for user files', function (done) {
        FileHandler.deleteFile(
          Settings.filestore.stores.user_files,
          key,
          err => {
            expect(err).not.to.exist
            expect(PersistorManager.deleteDirectory).to.not.have.been.called
            done()
          }
        )
      })
    })
  })

  describe('deleteProject', function () {
    it('should tell the filestore manager to delete the folder', function (done) {
      FileHandler.deleteProject(bucket, projectKey, err => {
        expect(err).not.to.exist
        expect(PersistorManager.deleteDirectory).to.have.been.calledWith(
          bucket,
          projectKey
        )
        done()
      })
    })

    it('should throw an error when the key is in the wrong format', function (done) {
      FileHandler.deleteProject(bucket, 'wombat', err => {
        expect(err).to.exist
        done()
      })
    })
  })

  describe('getFile', function () {
    it('should return the source stream no format or style are defined', function (done) {
      FileHandler.getFile(bucket, key, null, (err, stream) => {
        expect(err).not.to.exist
        expect(stream).to.equal(sourceStream)
        done()
      })
    })

    it('should pass options through to PersistorManager', function (done) {
      const options = { start: 0, end: 8 }
      FileHandler.getFile(bucket, key, options, err => {
        expect(err).not.to.exist
        expect(PersistorManager.getObjectStream).to.have.been.calledWith(
          bucket,
          key,
          options
        )
        done()
      })
    })

    describe('when a format is defined', function () {
      let result

      describe('when the file is not cached', function () {
        beforeEach(function (done) {
          FileHandler.getFile(bucket, key, { format: 'png' }, (err, stream) => {
            result = { err, stream }
            done()
          })
        })

        it('should convert the file', function () {
          expect(FileConverter.promises.convert).to.have.been.called
        })

        it('should compress the converted file', function () {
          expect(ImageOptimiser.promises.compressPng).to.have.been.called
        })

        it('should return the the converted stream', function () {
          expect(result.err).not.to.exist
          expect(result.stream).to.equal(readStream)
          expect(PersistorManager.getObjectStream).to.have.been.calledWith(
            bucket,
            key
          )
        })
      })

      describe('when the file is cached', function () {
        beforeEach(function (done) {
          PersistorManager.checkIfObjectExists = sinon.stub().resolves(true)
          FileHandler.getFile(bucket, key, { format: 'png' }, (err, stream) => {
            result = { err, stream }
            done()
          })
        })

        it('should not convert the file', function () {
          expect(FileConverter.promises.convert).not.to.have.been.called
        })

        it('should not compress the converted file again', function () {
          expect(ImageOptimiser.promises.compressPng).not.to.have.been.called
        })

        it('should return the cached stream', function () {
          expect(result.err).not.to.exist
          expect(result.stream).to.equal(sourceStream)
          expect(PersistorManager.getObjectStream).to.have.been.calledWith(
            bucket,
            convertedKey
          )
        })
      })
    })

    describe('when a style is defined', function () {
      it('generates a thumbnail when requested', function (done) {
        FileHandler.getFile(bucket, key, { style: 'thumbnail' }, err => {
          expect(err).not.to.exist
          expect(FileConverter.promises.thumbnail).to.have.been.called
          expect(FileConverter.promises.preview).not.to.have.been.called
          done()
        })
      })

      it('generates a preview when requested', function (done) {
        FileHandler.getFile(bucket, key, { style: 'preview' }, err => {
          expect(err).not.to.exist
          expect(FileConverter.promises.thumbnail).not.to.have.been.called
          expect(FileConverter.promises.preview).to.have.been.called
          done()
        })
      })
    })
  })

  describe('getRedirectUrl', function () {
    beforeEach(function () {
      Settings.filestore = {
        allowRedirects: true,
        stores: {
          userFiles: bucket,
        },
      }
    })

    it('should return a redirect url', function (done) {
      FileHandler.getRedirectUrl(bucket, key, (err, url) => {
        expect(err).not.to.exist
        expect(url).to.equal(redirectUrl)
        done()
      })
    })

    it('should call the persistor to get a redirect url', function (done) {
      FileHandler.getRedirectUrl(bucket, key, () => {
        expect(PersistorManager.getRedirectUrl).to.have.been.calledWith(
          bucket,
          key
        )
        done()
      })
    })

    it('should return null if options are supplied', function (done) {
      FileHandler.getRedirectUrl(
        bucket,
        key,
        { start: 100, end: 200 },
        (err, url) => {
          expect(err).not.to.exist
          expect(url).to.be.null
          done()
        }
      )
    })

    it('should return null if the bucket is not one of the defined ones', function (done) {
      FileHandler.getRedirectUrl('a_different_bucket', key, (err, url) => {
        expect(err).not.to.exist
        expect(url).to.be.null
        done()
      })
    })

    it('should return null if redirects are not enabled', function (done) {
      Settings.filestore.allowRedirects = false
      FileHandler.getRedirectUrl(bucket, key, (err, url) => {
        expect(err).not.to.exist
        expect(url).to.be.null
        done()
      })
    })
  })

  describe('getDirectorySize', function () {
    it('should call the filestore manager to get directory size', function (done) {
      FileHandler.getDirectorySize(bucket, key, err => {
        expect(err).not.to.exist
        expect(PersistorManager.directorySize).to.have.been.calledWith(
          bucket,
          key
        )
        done()
      })
    })
  })
})
