const { EventEmitter } = require('node:events')
const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const modulePath = '../../src/GcsPersistor.js'
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb')
const asyncPool = require('tiny-async-pool')

const Errors = require('../../src/Errors')

describe('GcsPersistorTests', function () {
  const filename = '/wombat/potato.tex'
  const bucket = 'womBucket'
  const key = 'monKey'
  const destKey = 'donKey'
  const genericError = new Error('guru meditation error')
  const filesSize = 33
  const md5 = 'ffffffff00000000ffffffff00000000'
  const WriteStream = 'writeStream'
  const redirectUrl = 'https://wombat.potato/giraffe'

  let Logger,
    Transform,
    PassThrough,
    Storage,
    Fs,
    GcsNotFoundError,
    ReadStream,
    Stream,
    StreamPromises,
    GcsBucket,
    GcsFile,
    GcsPersistor,
    FileNotFoundError,
    Hash,
    Settings,
    crypto,
    files

  beforeEach(function () {
    Settings = {
      directoryKeyRegex: /^[0-9a-fA-F]{24}\/[0-9a-fA-F]{24}/,
    }

    files = [
      {
        metadata: { size: '11', md5Hash: '/////wAAAAD/////AAAAAA==' },
        delete: sinon.stub(),
      },
      {
        metadata: { size: '22', md5Hash: '/////wAAAAD/////AAAAAA==' },
        delete: sinon.stub(),
      },
    ]

    class FakeGCSResponse extends EventEmitter {
      constructor() {
        super()
        this.statusCode = 200
        this.err = null
      }

      read() {
        if (this.err) return this.emit('error', this.err)
        this.emit('response', { statusCode: this.statusCode, headers: {} })
      }
    }

    ReadStream = new FakeGCSResponse()
    PassThrough = class {}

    Transform = class {
      once() {}
    }

    Stream = {
      PassThrough,
      Transform,
    }

    StreamPromises = {
      pipeline: sinon.stub().resolves(),
    }

    GcsFile = {
      delete: sinon.stub().resolves(),
      createReadStream: sinon.stub().returns(ReadStream),
      getMetadata: sinon.stub().resolves([files[0].metadata]),
      createWriteStream: sinon.stub().returns(WriteStream),
      copy: sinon.stub().resolves(),
      exists: sinon.stub().resolves([true]),
      getSignedUrl: sinon.stub().resolves([redirectUrl]),
    }

    GcsBucket = {
      file: sinon.stub().returns(GcsFile),
      getFiles: sinon.stub().resolves([files]),
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
      createReadStream: sinon.stub().returns(ReadStream),
    }

    FileNotFoundError = new Error('File not found')
    FileNotFoundError.code = 'ENOENT'

    Hash = {
      end: sinon.stub(),
      read: sinon.stub().returns(md5),
      digest: sinon.stub().returns(md5),
      setEncoding: sinon.stub(),
    }
    crypto = {
      createHash: sinon.stub().returns(Hash),
    }

    Logger = {
      warn: sinon.stub(),
    }

    GcsPersistor = new (SandboxedModule.require(modulePath, {
      requires: {
        '@google-cloud/storage': { Storage },
        '@overleaf/logger': Logger,
        'tiny-async-pool': asyncPool,
        './Errors': Errors,
        fs: Fs,
        stream: Stream,
        'stream/promises': StreamPromises,
        crypto,
      },
      globals: { console, Buffer },
    }))(Settings)
  })

  describe('getObjectStream', function () {
    describe('when called with valid parameters', function () {
      let stream

      beforeEach(async function () {
        stream = await GcsPersistor.getObjectStream(bucket, key)
      })

      it('returns a PassThrough stream', function () {
        expect(stream).to.be.instanceOf(PassThrough)
      })

      it('fetches the right key from the right bucket', function () {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.file).to.have.been.calledWith(key)
        expect(GcsFile.createReadStream).to.have.been.called
      })

      it('disables automatic decompression', function () {
        expect(GcsFile.createReadStream).to.have.been.calledWith({
          decompress: false,
        })
      })

      it('pipes the stream through the meter', function () {
        expect(StreamPromises.pipeline).to.have.been.calledWith(
          ReadStream,
          sinon.match.instanceOf(Transform),
          sinon.match.instanceOf(PassThrough)
        )
      })
    })

    describe('when called with a byte range', function () {
      let stream

      beforeEach(async function () {
        stream = await GcsPersistor.getObjectStream(bucket, key, {
          start: 5,
          end: 10,
        })
      })

      it('returns a PassThrough stream', function () {
        expect(stream).to.be.instanceOf(PassThrough)
      })

      it('passes the byte range on to GCS', function () {
        expect(GcsFile.createReadStream).to.have.been.calledWith({
          decompress: false,
          start: 5,
          end: 10,
        })
      })
    })

    describe("when the file doesn't exist", function () {
      let error, stream

      beforeEach(async function () {
        ReadStream.statusCode = 404
        try {
          stream = await GcsPersistor.getObjectStream(bucket, key)
        } catch (e) {
          error = e
        }
      })

      it('does not return a stream', function () {
        expect(stream).not.to.exist
      })

      it('throws a NotFoundError', function () {
        expect(error).to.be.an.instanceOf(Errors.NotFoundError)
      })

      it('wraps the error', function () {
        expect(error.cause).to.exist
      })

      it('stores the bucket and key in the error', function () {
        expect(error.info).to.include({ bucketName: bucket, key })
      })
    })

    describe('when Gcs encounters an unknown error', function () {
      let error, stream

      beforeEach(async function () {
        ReadStream.err = genericError
        try {
          stream = await GcsPersistor.getObjectStream(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('does not return a stream', function () {
        expect(stream).not.to.exist
      })

      it('throws a ReadError', function () {
        expect(error).to.be.an.instanceOf(Errors.ReadError)
      })

      it('wraps the error', function () {
        expect(error.cause).to.exist
      })

      it('stores the bucket and key in the error', function () {
        expect(error.info).to.include({ bucketName: bucket, key })
      })
    })
  })

  describe('getRedirectUrl', function () {
    let signedUrl

    describe('with signed URLs', function () {
      beforeEach(async function () {
        signedUrl = await GcsPersistor.getRedirectUrl(bucket, key)
      })

      it('should request a signed URL', function () {
        expect(GcsFile.getSignedUrl).to.have.been.called
      })

      it('should return the url', function () {
        expect(signedUrl).to.equal(redirectUrl)
      })
    })

    describe('with unsigned URLs', function () {
      beforeEach(async function () {
        GcsPersistor.settings.unsignedUrls = true
        GcsPersistor.settings.endpoint = {
          apiEndpoint: 'http://custom.endpoint',
        }
        signedUrl = await GcsPersistor.getRedirectUrl(bucket, key)
      })

      it('should return a plain URL', function () {
        expect(signedUrl).to.equal(
          `http://custom.endpoint/download/storage/v1/b/${bucket}/o/${key}?alt=media`
        )
      })
    })
  })

  describe('getObjectSize', function () {
    describe('when called with valid parameters', function () {
      let size

      beforeEach(async function () {
        size = await GcsPersistor.getObjectSize(bucket, key)
      })

      it('should return the object size', function () {
        expect(size).to.equal(11)
      })

      it('should pass the bucket and key to GCS', function () {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.file).to.have.been.calledWith(key)
        expect(GcsFile.getMetadata).to.have.been.called
      })
    })

    describe('when the object is not found', function () {
      let error

      beforeEach(async function () {
        GcsFile.getMetadata = sinon.stub().rejects(GcsNotFoundError)
        try {
          await GcsPersistor.getObjectSize(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should return a NotFoundError', function () {
        expect(error).to.be.an.instanceOf(Errors.NotFoundError)
      })

      it('should wrap the error', function () {
        expect(error.cause).to.equal(GcsNotFoundError)
      })
    })

    describe('when GCS returns an error', function () {
      let error

      beforeEach(async function () {
        GcsFile.getMetadata = sinon.stub().rejects(genericError)
        try {
          await GcsPersistor.getObjectSize(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should return a ReadError', function () {
        expect(error).to.be.an.instanceOf(Errors.ReadError)
      })

      it('should wrap the error', function () {
        expect(error.cause).to.equal(genericError)
      })
    })
  })

  describe('sendStream', function () {
    describe('with valid parameters', function () {
      beforeEach(async function () {
        return GcsPersistor.sendStream(bucket, key, ReadStream)
      })

      it('should upload the stream', function () {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.file).to.have.been.calledWith(key)
        expect(GcsFile.createWriteStream).to.have.been.called
      })

      it('should not try to create a resumable upload', function () {
        expect(GcsFile.createWriteStream).to.have.been.calledWith({
          resumable: false,
        })
      })

      it('should meter the stream and pass it to GCS', function () {
        expect(StreamPromises.pipeline).to.have.been.calledWith(
          ReadStream,
          sinon.match.instanceOf(Transform),
          WriteStream
        )
      })

      it('calculates the md5 hash of the file', function () {
        expect(Hash.digest).to.have.been.called
      })
    })

    describe('when a hash is supplied', function () {
      beforeEach(async function () {
        return GcsPersistor.sendStream(bucket, key, ReadStream, {
          sourceMd5: 'aaaaaaaabbbbbbbbaaaaaaaabbbbbbbb',
        })
      })

      it('should not calculate the md5 hash of the file', function () {
        expect(Hash.digest).not.to.have.been.called
      })

      it('sends the hash in base64', function () {
        expect(GcsFile.createWriteStream).to.have.been.calledWith({
          validation: 'md5',
          metadata: {
            md5Hash: 'qqqqqru7u7uqqqqqu7u7uw==',
          },
          resumable: false,
        })
      })

      it('does not fetch the md5 hash of the uploaded file', function () {
        expect(GcsFile.getMetadata).not.to.have.been.called
      })
    })

    describe('when metadata is supplied', function () {
      const contentType = 'text/csv'
      const contentEncoding = 'gzip'

      beforeEach(async function () {
        return GcsPersistor.sendStream(bucket, key, ReadStream, {
          contentType,
          contentEncoding,
        })
      })

      it('should send the metadata to GCS', function () {
        expect(GcsFile.createWriteStream).to.have.been.calledWith({
          metadata: { contentType, contentEncoding },
          resumable: false,
        })
      })
    })

    describe('when the upload fails', function () {
      let error
      beforeEach(async function () {
        StreamPromises.pipeline
          .withArgs(ReadStream, sinon.match.instanceOf(Transform), WriteStream)
          .rejects(genericError)
        try {
          await GcsPersistor.sendStream(bucket, key, ReadStream)
        } catch (err) {
          error = err
        }
      })

      it('throws a WriteError', function () {
        expect(error).to.be.an.instanceOf(Errors.WriteError)
      })

      it('wraps the error', function () {
        expect(error.cause).to.equal(genericError)
      })
    })
  })

  describe('sendFile', function () {
    describe('with valid parameters', function () {
      beforeEach(async function () {
        return GcsPersistor.sendFile(bucket, key, filename)
      })

      it('should create a read stream for the file', function () {
        expect(Fs.createReadStream).to.have.been.calledWith(filename)
      })

      it('should create a write stream', function () {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.file).to.have.been.calledWith(key)
        expect(GcsFile.createWriteStream).to.have.been.called
      })

      it('should upload the stream via the meter', function () {
        expect(StreamPromises.pipeline).to.have.been.calledWith(
          ReadStream,
          sinon.match.instanceOf(Transform),
          WriteStream
        )
      })
    })
  })

  describe('copyObject', function () {
    const destinationFile = 'destFile'

    beforeEach(function () {
      GcsBucket.file.withArgs(destKey).returns(destinationFile)
    })

    describe('with valid parameters', function () {
      beforeEach(async function () {
        return GcsPersistor.copyObject(bucket, key, destKey)
      })

      it('should copy the object', function () {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.file).to.have.been.calledWith(key)
        expect(GcsFile.copy).to.have.been.calledWith(destinationFile)
      })
    })

    describe('when the file does not exist', function () {
      let error

      beforeEach(async function () {
        GcsFile.copy = sinon.stub().rejects(GcsNotFoundError)
        try {
          await GcsPersistor.copyObject(bucket, key, destKey)
        } catch (err) {
          error = err
        }
      })

      it('should throw a NotFoundError', function () {
        expect(error).to.be.an.instanceOf(Errors.NotFoundError)
      })
    })
  })

  describe('deleteObject', function () {
    describe('with valid parameters', function () {
      beforeEach(async function () {
        return GcsPersistor.deleteObject(bucket, key)
      })

      it('should delete the object', function () {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.file).to.have.been.calledWith(key)
        expect(GcsFile.delete).to.have.been.called
      })
    })

    describe('when the file does not exist', function () {
      let error

      beforeEach(async function () {
        GcsFile.delete = sinon.stub().rejects(GcsNotFoundError)
        try {
          await GcsPersistor.deleteObject(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should not throw an error', function () {
        expect(error).not.to.exist
      })
    })
  })

  describe('deleteDirectory', function () {
    const directoryName = `${new ObjectId()}/${new ObjectId()}`
    const directoryPrefix = `${directoryName}/`
    describe('with valid parameters', function () {
      beforeEach(async function () {
        GcsBucket.getFiles = sinon.stub()
        // set up multiple paginated calls to getFiles
        GcsBucket.getFiles
          .withArgs({ prefix: directoryPrefix, autoPaginate: false })
          .resolves([['aaa', 'bbb'], 'call-1'])
        GcsBucket.getFiles
          .withArgs('call-1')
          .resolves([['ccc', 'ddd', 'eee'], 'call-2'])
        GcsBucket.getFiles.withArgs('call-2').resolves([['fff', 'ggg']])
        return GcsPersistor.deleteDirectory(bucket, directoryName)
      })

      it('should list the objects in the directory', function () {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.getFiles).to.have.been.calledWith({
          prefix: directoryPrefix,
          autoPaginate: false,
        })
        expect(GcsBucket.getFiles).to.have.been.calledWith('call-1')
        expect(GcsBucket.getFiles).to.have.been.calledWith('call-2')
      })

      it('should delete the files', function () {
        expect(GcsFile.delete.callCount).to.equal(7)
      })
    })

    describe('when there is an error listing the objects', function () {
      let error

      beforeEach(async function () {
        GcsBucket.getFiles = sinon.stub().rejects(genericError)
        try {
          await GcsPersistor.deleteDirectory(bucket, directoryName)
        } catch (err) {
          error = err
        }
      })

      it('should generate a WriteError', function () {
        expect(error).to.be.an.instanceOf(Errors.WriteError)
      })

      it('should wrap the error', function () {
        expect(error.cause).to.equal(genericError)
      })
    })
  })

  describe('directorySize', function () {
    describe('with valid parameters', function () {
      let size

      beforeEach(async function () {
        size = await GcsPersistor.directorySize(bucket, key)
      })

      it('should list the objects in the directory', function () {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.getFiles).to.have.been.calledWith({
          prefix: `${key}/`,
        })
      })

      it('should return the directory size', function () {
        expect(size).to.equal(filesSize)
      })
    })

    describe('when there are no files', function () {
      let size

      beforeEach(async function () {
        GcsBucket.getFiles.resolves([[]])
        size = await GcsPersistor.directorySize(bucket, key)
      })

      it('should list the objects in the directory', function () {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.getFiles).to.have.been.calledWith({
          prefix: `${key}/`,
        })
      })

      it('should return zero', function () {
        expect(size).to.equal(0)
      })
    })

    describe('when there is an error listing the objects', function () {
      let error

      beforeEach(async function () {
        GcsBucket.getFiles.rejects(genericError)
        try {
          await GcsPersistor.directorySize(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should generate a ReadError', function () {
        expect(error).to.be.an.instanceOf(Errors.ReadError)
      })

      it('should wrap the error', function () {
        expect(error.cause).to.equal(genericError)
      })
    })
  })

  describe('checkIfObjectExists', function () {
    describe('when the file exists', function () {
      let exists

      beforeEach(async function () {
        exists = await GcsPersistor.checkIfObjectExists(bucket, key)
      })

      it('should ask the file if it exists', function () {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.file).to.have.been.calledWith(key)
        expect(GcsFile.exists).to.have.been.called
      })

      it('should return that the file exists', function () {
        expect(exists).to.equal(true)
      })
    })

    describe('when the file does not exist', function () {
      let exists

      beforeEach(async function () {
        GcsFile.exists = sinon.stub().resolves([false])
        exists = await GcsPersistor.checkIfObjectExists(bucket, key)
      })

      it('should get the object header', function () {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.file).to.have.been.calledWith(key)
        expect(GcsFile.exists).to.have.been.called
      })

      it('should return that the file does not exist', function () {
        expect(exists).to.equal(false)
      })
    })

    describe('when there is an error', function () {
      let error

      beforeEach(async function () {
        GcsFile.exists = sinon.stub().rejects(genericError)
        try {
          await GcsPersistor.checkIfObjectExists(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should generate a ReadError', function () {
        expect(error).to.be.an.instanceOf(Errors.ReadError)
      })

      it('should wrap the error', function () {
        expect(error.cause).to.equal(genericError)
      })
    })
  })

  describe('listDirectoryKeys', function () {
    describe('with valid parameters', function () {
      let keys

      beforeEach(async function () {
        const filesWithNames = files.map((file, i) => ({
          ...file,
          name: i === 0 ? 'llama' : 'hippo',
        }))
        GcsBucket.getFiles.resolves([filesWithNames])
        keys = await GcsPersistor.listDirectoryKeys(bucket, key)
      })

      it('should list the objects in the directory', function () {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.getFiles).to.have.been.calledWith({
          prefix: `${key}/`,
        })
      })

      it('should return the keys', function () {
        expect(keys).to.deep.equal(['llama', 'hippo'])
      })
    })

    describe('when there are no files', function () {
      let keys

      beforeEach(async function () {
        GcsBucket.getFiles.resolves([[]])
        keys = await GcsPersistor.listDirectoryKeys(bucket, key)
      })

      it('should return an empty array', function () {
        expect(keys).to.deep.equal([])
      })
    })

    describe('when there is an error listing the objects', function () {
      let error

      beforeEach(async function () {
        GcsBucket.getFiles.rejects(genericError)
        try {
          await GcsPersistor.listDirectoryKeys(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should generate a ReadError', function () {
        expect(error).to.be.an.instanceOf(Errors.ReadError)
      })

      it('should wrap the error', function () {
        expect(error.cause).to.equal(genericError)
      })
    })
  })

  describe('listDirectoryStats', function () {
    describe('with valid parameters', function () {
      let stats

      beforeEach(async function () {
        const filesWithNames = files.map((file, i) => ({
          ...file,
          name: i === 0 ? 'llama' : 'hippo',
        }))
        GcsBucket.getFiles.resolves([filesWithNames])
        stats = await GcsPersistor.listDirectoryStats(bucket, key)
      })

      it('should list the objects in the directory', function () {
        expect(Storage.prototype.bucket).to.have.been.calledWith(bucket)
        expect(GcsBucket.getFiles).to.have.been.calledWith({
          prefix: `${key}/`,
        })
      })

      it('should return the stats', function () {
        expect(stats).to.deep.equal([
          { key: 'llama', size: 11 },
          { key: 'hippo', size: 22 },
        ])
      })
    })

    describe('when there are no files', function () {
      let stats

      beforeEach(async function () {
        GcsBucket.getFiles.resolves([[]])
        stats = await GcsPersistor.listDirectoryStats(bucket, key)
      })

      it('should return an empty array', function () {
        expect(stats).to.deep.equal([])
      })
    })

    describe('when there is an error listing the objects', function () {
      let error

      beforeEach(async function () {
        GcsBucket.getFiles.rejects(genericError)
        try {
          await GcsPersistor.listDirectoryStats(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should generate a ReadError', function () {
        expect(error).to.be.an.instanceOf(Errors.ReadError)
      })

      it('should wrap the error', function () {
        expect(error.cause).to.equal(genericError)
      })
    })
  })
})
