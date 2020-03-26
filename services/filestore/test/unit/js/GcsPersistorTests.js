const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const modulePath = '../../../app/js/GcsPersistor.js'
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb')
const asyncPool = require('tiny-async-pool')

const Errors = require('../../../app/js/Errors')

describe('GcsPersistorTests', function() {
  const filename = '/wombat/potato.tex'
  const bucket = 'womBucket'
  const key = 'monKey'
  const destKey = 'donKey'
  const genericError = new Error('guru meditation error')
  const filesSize = 33
  const md5 = 'ffffffff00000000ffffffff00000000'
  const WriteStream = 'writeStream'

  let Metrics,
    Logger,
    Transform,
    Storage,
    Fs,
    GcsNotFoundError,
    ReadStream,
    Stream,
    GcsBucket,
    GcsFile,
    GcsPersistor,
    FileNotFoundError,
    Hash,
    settings,
    crypto,
    files

  beforeEach(function() {
    settings = {
      filestore: {
        backend: 'gcs',
        stores: {
          user_files: 'user_files'
        },
        gcs: {
          directoryKeyRegex: /^[0-9a-fA-F]{24}\/[0-9a-fA-F]{24}/
        }
      }
    }

    files = [
      {
        metadata: { size: 11, md5Hash: '/////wAAAAD/////AAAAAA==' },
        delete: sinon.stub()
      },
      {
        metadata: { size: 22, md5Hash: '/////wAAAAD/////AAAAAA==' },
        delete: sinon.stub()
      }
    ]

    ReadStream = {
      pipe: sinon.stub().returns('readStream'),
      on: sinon
        .stub()
        .withArgs('end')
        .yields(),
      removeListener: sinon.stub()
    }

    Transform = class {
      on(event, callback) {
        if (event === 'readable') {
          callback()
        }
      }

      once() {}
      removeListener() {}
    }

    Stream = {
      pipeline: sinon.stub().yields(),
      Transform: Transform
    }

    Metrics = {
      count: sinon.stub()
    }

    GcsFile = {
      delete: sinon.stub().resolves(),
      createReadStream: sinon.stub().returns(ReadStream),
      getMetadata: sinon.stub().resolves([files[0].metadata]),
      createWriteStream: sinon.stub().returns(WriteStream),
      copy: sinon.stub().resolves(),
      exists: sinon.stub().resolves([true])
    }

    GcsBucket = {
      file: sinon.stub().returns(GcsFile),
      getFiles: sinon.stub().resolves([files])
    }

    Storage = class {
      constructor() {
        this.interceptors = []
      }
    }
    Storage.prototype.bucket = sinon.stub().returns(GcsBucket)

    GcsNotFoundError = new Error('File not found')
    GcsNotFoundError.code = 404

    Fs = {
      createReadStream: sinon.stub().returns(ReadStream)
    }

    FileNotFoundError = new Error('File not found')
    FileNotFoundError.code = 'ENOENT'

    Hash = {
      end: sinon.stub(),
      read: sinon.stub().returns(md5),
      digest: sinon.stub().returns(md5),
      setEncoding: sinon.stub()
    }
    crypto = {
      createHash: sinon.stub().returns(Hash)
    }

    Logger = {
      warn: sinon.stub()
    }

    GcsPersistor = SandboxedModule.require(modulePath, {
      requires: {
        '@google-cloud/storage': { Storage },
        'settings-sharelatex': settings,
        'logger-sharelatex': Logger,
        'tiny-async-pool': asyncPool,
        './Errors': Errors,
        fs: Fs,
        stream: Stream,
        'metrics-sharelatex': Metrics,
        crypto
      },
      globals: { console, Buffer }
    })
  })

  describe('getFileStream', function() {
    describe('when called with valid parameters', function() {
      let stream

      beforeEach(async function() {
        stream = await GcsPersistor.promises.getFileStream(bucket, key)
      })

      it('returns a metered stream', function() {
        expect(stream).to.be.instanceOf(Transform)
      })

      it('fetches the right key from the right bucket', function() {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.file).to.have.been.calledWith(key)
        expect(GcsFile.createReadStream).to.have.been.called
      })

      it('pipes the stream through the meter', function() {
        expect(Stream.pipeline).to.have.been.calledWith(
          ReadStream,
          sinon.match.instanceOf(Transform)
        )
      })
    })

    describe('when called with a byte range', function() {
      let stream

      beforeEach(async function() {
        stream = await GcsPersistor.promises.getFileStream(bucket, key, {
          start: 5,
          end: 10
        })
      })

      it('returns a metered stream', function() {
        expect(stream).to.be.instanceOf(Transform)
      })

      it('passes the byte range on to GCS', function() {
        expect(GcsFile.createReadStream).to.have.been.calledWith({
          start: 5,
          end: 11 // we increment the end because Google's 'end' is exclusive
        })
      })
    })

    describe("when the file doesn't exist", function() {
      let error, stream

      beforeEach(async function() {
        Transform.prototype.on = sinon.stub()
        Transform.prototype.on.withArgs('error').yields(GcsNotFoundError)
        try {
          stream = await GcsPersistor.promises.getFileStream(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('does not return a stream', function() {
        expect(stream).not.to.exist
      })

      it('throws a NotFoundError', function() {
        expect(error).to.be.an.instanceOf(Errors.NotFoundError)
      })

      it('wraps the error', function() {
        expect(error.cause).to.exist
      })

      it('stores the bucket and key in the error', function() {
        expect(error.info).to.include({ bucketName: bucket, key: key })
      })
    })

    describe('when Gcs encounters an unkown error', function() {
      let error, stream

      beforeEach(async function() {
        Transform.prototype.on = sinon.stub()
        Transform.prototype.on.withArgs('error').yields(genericError)
        try {
          stream = await GcsPersistor.promises.getFileStream(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('does not return a stream', function() {
        expect(stream).not.to.exist
      })

      it('throws a ReadError', function() {
        expect(error).to.be.an.instanceOf(Errors.ReadError)
      })

      it('wraps the error', function() {
        expect(error.cause).to.exist
      })

      it('stores the bucket and key in the error', function() {
        expect(error.info).to.include({ bucketName: bucket, key: key })
      })
    })
  })

  describe('getFileSize', function() {
    describe('when called with valid parameters', function() {
      let size

      beforeEach(async function() {
        size = await GcsPersistor.promises.getFileSize(bucket, key)
      })

      it('should return the object size', function() {
        expect(size).to.equal(files[0].metadata.size)
      })

      it('should pass the bucket and key to GCS', function() {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.file).to.have.been.calledWith(key)
        expect(GcsFile.getMetadata).to.have.been.called
      })
    })

    describe('when the object is not found', function() {
      let error

      beforeEach(async function() {
        GcsFile.getMetadata = sinon.stub().rejects(GcsNotFoundError)
        try {
          await GcsPersistor.promises.getFileSize(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should return a NotFoundError', function() {
        expect(error).to.be.an.instanceOf(Errors.NotFoundError)
      })

      it('should wrap the error', function() {
        expect(error.cause).to.equal(GcsNotFoundError)
      })
    })

    describe('when GCS returns an error', function() {
      let error

      beforeEach(async function() {
        GcsFile.getMetadata = sinon.stub().rejects(genericError)
        try {
          await GcsPersistor.promises.getFileSize(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should return a ReadError', function() {
        expect(error).to.be.an.instanceOf(Errors.ReadError)
      })

      it('should wrap the error', function() {
        expect(error.cause).to.equal(genericError)
      })
    })
  })

  describe('sendStream', function() {
    describe('with valid parameters', function() {
      beforeEach(async function() {
        return GcsPersistor.promises.sendStream(bucket, key, ReadStream)
      })

      it('should upload the stream', function() {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.file).to.have.been.calledWith(key)
        expect(GcsFile.createWriteStream).to.have.been.called
      })

      it('should not try to create a resumable upload', function() {
        expect(GcsFile.createWriteStream).to.have.been.calledWith({
          resumable: false
        })
      })

      it('should meter the stream and pass it to GCS', function() {
        expect(Stream.pipeline).to.have.been.calledWith(
          ReadStream,
          sinon.match.instanceOf(Transform),
          WriteStream
        )
      })

      it('calculates the md5 hash of the file', function() {
        expect(Hash.digest).to.have.been.called
      })
    })

    describe('when a hash is supplied', function() {
      beforeEach(async function() {
        return GcsPersistor.promises.sendStream(
          bucket,
          key,
          ReadStream,
          'aaaaaaaabbbbbbbbaaaaaaaabbbbbbbb'
        )
      })

      it('should not calculate the md5 hash of the file', function() {
        expect(Hash.digest).not.to.have.been.called
      })

      it('sends the hash in base64', function() {
        expect(GcsFile.createWriteStream).to.have.been.calledWith({
          validation: 'md5',
          metadata: {
            md5Hash: 'qqqqqru7u7uqqqqqu7u7uw=='
          },
          resumable: false
        })
      })

      it('does not fetch the md5 hash of the uploaded file', function() {
        expect(GcsFile.getMetadata).not.to.have.been.called
      })
    })

    describe('when the upload fails', function() {
      let error
      beforeEach(async function() {
        Stream.pipeline
          .withArgs(
            ReadStream,
            sinon.match.instanceOf(Transform),
            WriteStream,
            sinon.match.any
          )
          .yields(genericError)
        try {
          await GcsPersistor.promises.sendStream(bucket, key, ReadStream)
        } catch (err) {
          error = err
        }
      })

      it('throws a WriteError', function() {
        expect(error).to.be.an.instanceOf(Errors.WriteError)
      })

      it('wraps the error', function() {
        expect(error.cause).to.equal(genericError)
      })
    })
  })

  describe('sendFile', function() {
    describe('with valid parameters', function() {
      beforeEach(async function() {
        return GcsPersistor.promises.sendFile(bucket, key, filename)
      })

      it('should create a read stream for the file', function() {
        expect(Fs.createReadStream).to.have.been.calledWith(filename)
      })

      it('should create a write stream', function() {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.file).to.have.been.calledWith(key)
        expect(GcsFile.createWriteStream).to.have.been.called
      })

      it('should upload the stream via the meter', function() {
        expect(Stream.pipeline).to.have.been.calledWith(
          ReadStream,
          sinon.match.instanceOf(Transform),
          WriteStream
        )
      })
    })
  })

  describe('copyFile', function() {
    const destinationFile = 'destFile'

    beforeEach(function() {
      GcsBucket.file.withArgs(destKey).returns(destinationFile)
    })

    describe('with valid parameters', function() {
      beforeEach(async function() {
        return GcsPersistor.promises.copyFile(bucket, key, destKey)
      })

      it('should copy the object', function() {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.file).to.have.been.calledWith(key)
        expect(GcsFile.copy).to.have.been.calledWith(destinationFile)
      })
    })

    describe('when the file does not exist', function() {
      let error

      beforeEach(async function() {
        GcsFile.copy = sinon.stub().rejects(GcsNotFoundError)
        try {
          await GcsPersistor.promises.copyFile(bucket, key, destKey)
        } catch (err) {
          error = err
        }
      })

      it('should throw a NotFoundError', function() {
        expect(error).to.be.an.instanceOf(Errors.NotFoundError)
      })
    })
  })

  describe('deleteFile', function() {
    describe('with valid parameters', function() {
      beforeEach(async function() {
        return GcsPersistor.promises.deleteFile(bucket, key)
      })

      it('should delete the object', function() {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.file).to.have.been.calledWith(key)
        expect(GcsFile.delete).to.have.been.called
      })
    })

    describe('when the file does not exist', function() {
      let error

      beforeEach(async function() {
        GcsFile.delete = sinon.stub().rejects(GcsNotFoundError)
        try {
          await GcsPersistor.promises.deleteFile(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should not throw an error', function() {
        expect(error).not.to.exist
      })
    })
  })

  describe('deleteDirectory', function() {
    const directoryName = `${ObjectId()}/${ObjectId()}`
    describe('with valid parameters', function() {
      beforeEach(async function() {
        console.log(key)
        return GcsPersistor.promises.deleteDirectory(bucket, directoryName)
      })

      it('should list the objects in the directory', function() {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.getFiles).to.have.been.calledWith({
          directory: directoryName
        })
      })

      it('should delete the files', function() {
        expect(GcsFile.delete).to.have.been.calledTwice
      })
    })

    describe('when there is an error listing the objects', function() {
      let error

      beforeEach(async function() {
        GcsBucket.getFiles = sinon.stub().rejects(genericError)
        try {
          await GcsPersistor.promises.deleteDirectory(bucket, directoryName)
        } catch (err) {
          error = err
        }
      })

      it('should generate a WriteError', function() {
        expect(error).to.be.an.instanceOf(Errors.WriteError)
      })

      it('should wrap the error', function() {
        expect(error.cause).to.equal(genericError)
      })
    })
  })

  describe('directorySize', function() {
    describe('with valid parameters', function() {
      let size

      beforeEach(async function() {
        size = await GcsPersistor.promises.directorySize(bucket, key)
      })

      it('should list the objects in the directory', function() {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.getFiles).to.have.been.calledWith({ directory: key })
      })

      it('should return the directory size', function() {
        expect(size).to.equal(filesSize)
      })
    })

    describe('when there are no files', function() {
      let size

      beforeEach(async function() {
        GcsBucket.getFiles.resolves([[]])
        size = await GcsPersistor.promises.directorySize(bucket, key)
      })

      it('should list the objects in the directory', function() {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.getFiles).to.have.been.calledWith({ directory: key })
      })

      it('should return zero', function() {
        expect(size).to.equal(0)
      })
    })

    describe('when there is an error listing the objects', function() {
      let error

      beforeEach(async function() {
        GcsBucket.getFiles.rejects(genericError)
        try {
          await GcsPersistor.promises.directorySize(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should generate a ReadError', function() {
        expect(error).to.be.an.instanceOf(Errors.ReadError)
      })

      it('should wrap the error', function() {
        expect(error.cause).to.equal(genericError)
      })
    })
  })

  describe('checkIfFileExists', function() {
    describe('when the file exists', function() {
      let exists

      beforeEach(async function() {
        exists = await GcsPersistor.promises.checkIfFileExists(bucket, key)
      })

      it('should ask the file if it exists', function() {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.file).to.have.been.calledWith(key)
        expect(GcsFile.exists).to.have.been.called
      })

      it('should return that the file exists', function() {
        expect(exists).to.equal(true)
      })
    })

    describe('when the file does not exist', function() {
      let exists

      beforeEach(async function() {
        GcsFile.exists = sinon.stub().resolves([false])
        exists = await GcsPersistor.promises.checkIfFileExists(bucket, key)
      })

      it('should get the object header', function() {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.file).to.have.been.calledWith(key)
        expect(GcsFile.exists).to.have.been.called
      })

      it('should return that the file does not exist', function() {
        expect(exists).to.equal(false)
      })
    })

    describe('when there is an error', function() {
      let error

      beforeEach(async function() {
        GcsFile.exists = sinon.stub().rejects(genericError)
        try {
          await GcsPersistor.promises.checkIfFileExists(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should generate a ReadError', function() {
        expect(error).to.be.an.instanceOf(Errors.ReadError)
      })

      it('should wrap the error', function() {
        expect(error.cause).to.equal(genericError)
      })
    })
  })
})
