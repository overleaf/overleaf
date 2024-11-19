const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../src/Errors')
const { EventEmitter } = require('node:events')

const MODULE_PATH = '../../src/S3Persistor.js'

describe('S3PersistorTests', function () {
  const defaultS3Key = 'frog'
  const defaultS3Secret = 'prince'
  const defaultS3Credentials = {
    credentials: {
      accessKeyId: defaultS3Key,
      secretAccessKey: defaultS3Secret,
    },
  }
  const filename = '/wombat/potato.tex'
  const bucket = 'womBucket'
  const key = 'monKey'
  const destKey = 'donKey'
  const objectSize = 5555
  const genericError = new Error('guru meditation error')
  const files = [
    { Key: 'llama', Size: 11 },
    { Key: 'hippo', Size: 22 },
  ]
  const filesSize = 33
  const md5 = 'ffffffff00000000ffffffff00000000'
  const redirectUrl = 'https://wombat.potato/giraffe'

  let Logger,
    Transform,
    PassThrough,
    S3,
    Fs,
    ReadStream,
    Stream,
    StreamPromises,
    S3GetObjectRequest,
    S3Persistor,
    S3Client,
    S3NotFoundError,
    S3AccessDeniedError,
    FileNotFoundError,
    EmptyPromise,
    settings,
    Hash,
    crypto

  beforeEach(function () {
    settings = {
      secret: defaultS3Secret,
      key: defaultS3Key,
      partSize: 100 * 1024 * 1024,
    }

    Transform = class {
      once() {}
    }

    PassThrough = class {}

    Stream = {
      Transform,
      PassThrough,
      pipeline: sinon.stub().yields(),
    }

    StreamPromises = {
      pipeline: sinon.stub().resolves(),
    }

    EmptyPromise = {
      promise: sinon.stub().resolves(),
    }

    ReadStream = new EventEmitter()
    class FakeS3GetObjectRequest extends EventEmitter {
      constructor() {
        super()
        this.statusCode = 200
        this.err = null
        this.aborted = false
      }

      abort() {
        this.aborted = true
      }

      createReadStream() {
        setTimeout(() => {
          if (this.notFoundSSEC) {
            // special case for AWS S3: 404 NoSuchKey wrapped in a 400. A single request received a single response, and multiple httpHeaders events are triggered. Don't ask.
            this.emit('httpHeaders', 400, {})
            this.emit('httpHeaders', 404, {})
            ReadStream.emit('error', S3NotFoundError)
            return
          }

          if (this.err) return ReadStream.emit('error', this.err)
          this.emit('httpHeaders', this.statusCode, {})
          if (this.statusCode === 403) {
            ReadStream.emit('error', S3AccessDeniedError)
          }
          if (this.statusCode === 404) {
            ReadStream.emit('error', S3NotFoundError)
          }
        })
        return ReadStream
      }
    }
    S3GetObjectRequest = new FakeS3GetObjectRequest()

    FileNotFoundError = new Error('File not found')
    FileNotFoundError.code = 'ENOENT'

    Fs = {
      createReadStream: sinon.stub().returns(ReadStream),
    }

    S3NotFoundError = new Error('not found')
    S3NotFoundError.code = 'NoSuchKey'

    S3AccessDeniedError = new Error('access denied')
    S3AccessDeniedError.code = 'AccessDenied'

    S3Client = {
      getObject: sinon.stub().returns(S3GetObjectRequest),
      headObject: sinon.stub().returns({
        promise: sinon.stub().resolves({
          ContentLength: objectSize,
          ETag: md5,
        }),
      }),
      listObjectsV2: sinon.stub().returns({
        promise: sinon.stub().resolves({
          Contents: files,
        }),
      }),
      upload: sinon
        .stub()
        .returns({ promise: sinon.stub().resolves({ ETag: `"${md5}"` }) }),
      copyObject: sinon.stub().returns(EmptyPromise),
      deleteObject: sinon.stub().returns(EmptyPromise),
      deleteObjects: sinon.stub().returns(EmptyPromise),
      getSignedUrlPromise: sinon.stub().resolves(redirectUrl),
    }
    S3 = sinon.stub().callsFake(() => Object.assign({}, S3Client))

    Hash = {
      end: sinon.stub(),
      read: sinon.stub().returns(md5),
      setEncoding: sinon.stub(),
    }
    crypto = {
      createHash: sinon.stub().returns(Hash),
    }

    Logger = {
      warn: sinon.stub(),
    }

    S3Persistor = new (SandboxedModule.require(MODULE_PATH, {
      requires: {
        'aws-sdk/clients/s3': S3,
        '@overleaf/logger': Logger,
        './Errors': Errors,
        fs: Fs,
        stream: Stream,
        'stream/promises': StreamPromises,
        crypto,
      },
      globals: { console, Buffer },
    }).S3Persistor)(settings)
  })

  describe('getObjectStream', function () {
    describe('when called with valid parameters', function () {
      let stream

      beforeEach(async function () {
        stream = await S3Persistor.getObjectStream(bucket, key)
      })

      it('returns a PassThrough stream', function () {
        expect(stream).to.be.instanceOf(PassThrough)
      })

      it('sets the AWS client up with credentials from settings', function () {
        expect(S3).to.have.been.calledWith(defaultS3Credentials)
      })

      it('fetches the right key from the right bucket', function () {
        expect(S3Client.getObject).to.have.been.calledWith({
          Bucket: bucket,
          Key: key,
        })
      })

      it('pipes the stream through the meter', async function () {
        expect(Stream.pipeline).to.have.been.calledWith(
          ReadStream,
          sinon.match.instanceOf(Transform),
          sinon.match.instanceOf(PassThrough)
        )
      })

      it('does not abort the request', function () {
        expect(S3GetObjectRequest.aborted).to.equal(false)
      })
    })

    describe('when called with a byte range', function () {
      let stream

      beforeEach(async function () {
        stream = await S3Persistor.getObjectStream(bucket, key, {
          start: 5,
          end: 10,
        })
      })

      it('returns a PassThrough stream', function () {
        expect(stream).to.be.instanceOf(Stream.PassThrough)
      })

      it('passes the byte range on to S3', function () {
        expect(S3Client.getObject).to.have.been.calledWith({
          Bucket: bucket,
          Key: key,
          Range: 'bytes=5-10',
        })
      })
    })

    describe('when streaming fails', function () {
      let stream

      beforeEach(async function () {
        Stream.pipeline.yields(new Error())
        stream = await S3Persistor.getObjectStream(bucket, key)
      })

      it('returns a PassThrough stream', function () {
        expect(stream).to.be.instanceOf(Stream.PassThrough)
      })

      it('aborts the request', function () {
        expect(S3GetObjectRequest.aborted).to.equal(true)
      })
    })

    describe('when there are alternative credentials', function () {
      let stream
      const alternativeSecret = 'giraffe'
      const alternativeKey = 'hippo'
      const alternativeS3Credentials = {
        credentials: {
          accessKeyId: alternativeKey,
          secretAccessKey: alternativeSecret,
        },
      }

      beforeEach(async function () {
        settings.bucketCreds = {}
        settings.bucketCreds[bucket] = {
          auth_key: alternativeKey,
          auth_secret: alternativeSecret,
        }

        stream = await S3Persistor.getObjectStream(bucket, key)
      })

      it('returns a PassThrough stream', function () {
        expect(stream).to.be.instanceOf(Stream.PassThrough)
      })

      it('sets the AWS client up with the alternative credentials', function () {
        expect(S3).to.have.been.calledWith(alternativeS3Credentials)
      })

      it('fetches the right key from the right bucket', function () {
        expect(S3Client.getObject).to.have.been.calledWith({
          Bucket: bucket,
          Key: key,
        })
      })

      it('uses the default credentials for an unknown bucket', async function () {
        stream = await S3Persistor.getObjectStream('anotherBucket', key)

        expect(S3).to.have.been.calledTwice
        expect(S3.firstCall).to.have.been.calledWith(alternativeS3Credentials)
        expect(S3.secondCall).to.have.been.calledWith(defaultS3Credentials)
      })
    })

    describe('without hard-coded credentials', function () {
      it('uses the default provider chain', async function () {
        delete settings.key
        delete settings.secret

        await S3Persistor.getObjectStream(bucket, key)
        expect(S3).to.have.been.calledOnce
        expect(S3.args[0].credentials).to.not.exist
      })
    })

    describe('when given S3 options', function () {
      const httpOptions = { timeout: 2000 }
      const maxRetries = 2

      beforeEach(async function () {
        settings.httpOptions = httpOptions
        settings.maxRetries = maxRetries
        await S3Persistor.getObjectStream(bucket, key)
      })

      it('configures the S3 client appropriately', function () {
        expect(S3).to.have.been.calledWithMatch({ httpOptions, maxRetries })
      })
    })

    describe("when the file doesn't exist", function () {
      let error, stream

      beforeEach(async function () {
        S3GetObjectRequest.statusCode = 404
        try {
          stream = await S3Persistor.getObjectStream(bucket, key)
        } catch (err) {
          error = err
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

    describe("when the file doesn't exist -- SSEC", function () {
      let error, stream

      beforeEach(async function () {
        S3GetObjectRequest.notFoundSSEC = 404
        try {
          stream = await S3Persistor.getObjectStream(bucket, key)
        } catch (err) {
          error = err
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

    describe('when access to the file is denied', function () {
      let error, stream

      beforeEach(async function () {
        S3GetObjectRequest.statusCode = 403
        try {
          stream = await S3Persistor.getObjectStream(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('does not return a stream', function () {
        expect(stream).not.to.exist
      })

      it('throws a NotFoundError', function () {
        expect(error).to.be.an.instanceOf(Errors.NotFoundError)
      })

      it('wraps the error', function () {
        expect(error.cause).to.equal(S3AccessDeniedError)
      })

      it('stores the bucket and key in the error', function () {
        expect(error.info).to.include({ bucketName: bucket, key })
      })
    })

    describe('when S3 encounters an unknown error', function () {
      let error, stream

      beforeEach(async function () {
        S3GetObjectRequest.err = genericError
        try {
          stream = await S3Persistor.getObjectStream(bucket, key)
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

    beforeEach(async function () {
      signedUrl = await S3Persistor.getRedirectUrl(bucket, key)
    })

    it('should request a signed URL', function () {
      expect(S3Client.getSignedUrlPromise).to.have.been.called
    })

    it('should return the url', function () {
      expect(signedUrl).to.equal(redirectUrl)
    })
  })

  describe('getObjectSize', function () {
    describe('when called with valid parameters', function () {
      let size

      beforeEach(async function () {
        size = await S3Persistor.getObjectSize(bucket, key)
      })

      it('should return the object size', function () {
        expect(size).to.equal(objectSize)
      })

      it('should pass the bucket and key to S3', function () {
        expect(S3Client.headObject).to.have.been.calledWith({
          Bucket: bucket,
          Key: key,
        })
      })
    })

    describe('when the object is not found', function () {
      let error

      beforeEach(async function () {
        S3Client.headObject = sinon.stub().returns({
          promise: sinon.stub().rejects(S3NotFoundError),
        })
        try {
          await S3Persistor.getObjectSize(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should return a NotFoundError', function () {
        expect(error).to.be.an.instanceOf(Errors.NotFoundError)
      })

      it('should wrap the error', function () {
        expect(error.cause).to.equal(S3NotFoundError)
      })
    })

    describe('when S3 returns an error', function () {
      let error

      beforeEach(async function () {
        S3Client.headObject = sinon.stub().returns({
          promise: sinon.stub().rejects(genericError),
        })
        try {
          await S3Persistor.getObjectSize(bucket, key)
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
        return S3Persistor.sendStream(bucket, key, ReadStream)
      })

      it('should upload the stream', function () {
        expect(S3Client.upload).to.have.been.calledWith({
          Bucket: bucket,
          Key: key,
          Body: sinon.match.instanceOf(Stream.Transform),
        })
      })

      it('should upload files in a single part', function () {
        expect(S3Client.upload).to.have.been.calledWith(sinon.match.any, {
          partSize: 100 * 1024 * 1024,
        })
      })

      it('should meter the stream', function () {
        expect(Stream.pipeline).to.have.been.calledWith(
          ReadStream,
          sinon.match.instanceOf(Stream.Transform)
        )
      })
    })

    describe('when a hash is supplied', function () {
      beforeEach(async function () {
        return S3Persistor.sendStream(bucket, key, ReadStream, {
          sourceMd5: 'aaaaaaaabbbbbbbbaaaaaaaabbbbbbbb',
        })
      })

      it('sends the hash in base64', function () {
        expect(S3Client.upload).to.have.been.calledWith({
          Bucket: bucket,
          Key: key,
          Body: sinon.match.instanceOf(Transform),
          ContentMD5: 'qqqqqru7u7uqqqqqu7u7uw==',
        })
      })
    })

    describe('when metadata is supplied', function () {
      const contentType = 'text/csv'
      const contentEncoding = 'gzip'

      beforeEach(async function () {
        return S3Persistor.sendStream(bucket, key, ReadStream, {
          contentType,
          contentEncoding,
        })
      })

      it('sends the metadata to S3', function () {
        expect(S3Client.upload).to.have.been.calledWith({
          Bucket: bucket,
          Key: key,
          Body: sinon.match.instanceOf(Transform),
          ContentType: contentType,
          ContentEncoding: contentEncoding,
        })
      })
    })

    describe('when the upload fails', function () {
      let error
      beforeEach(async function () {
        S3Client.upload = sinon.stub().returns({
          promise: sinon.stub().rejects(genericError),
        })
        try {
          await S3Persistor.sendStream(bucket, key, ReadStream)
        } catch (err) {
          error = err
        }
      })

      it('throws a WriteError', function () {
        expect(error).to.be.an.instanceOf(Errors.WriteError)
      })
    })
  })

  describe('sendFile', function () {
    describe('with valid parameters', function () {
      beforeEach(async function () {
        return S3Persistor.sendFile(bucket, key, filename)
      })

      it('should create a read stream for the file', function () {
        expect(Fs.createReadStream).to.have.been.calledWith(filename)
      })

      it('should upload the stream', function () {
        expect(S3Client.upload).to.have.been.calledWith({
          Bucket: bucket,
          Key: key,
          Body: sinon.match.instanceOf(Transform),
        })
      })
    })
  })

  describe('getObjectMd5Hash', function () {
    describe('when the etag is a valid md5 hash', function () {
      let hash
      beforeEach(async function () {
        hash = await S3Persistor.getObjectMd5Hash(bucket, key)
      })

      it('should return the object hash', function () {
        expect(hash).to.equal(md5)
      })

      it('should get the hash from the object metadata', function () {
        expect(S3Client.headObject).to.have.been.calledWith({
          Bucket: bucket,
          Key: key,
        })
      })

      it('should not download the object', function () {
        expect(S3Client.getObject).not.to.have.been.called
      })
    })

    describe("when the etag isn't a valid md5 hash", function () {
      let hash
      beforeEach(async function () {
        S3Client.headObject = sinon.stub().returns({
          promise: sinon.stub().resolves({
            ETag: 'somethingthatisntanmd5',
            Bucket: bucket,
            Key: key,
          }),
        })

        hash = await S3Persistor.getObjectMd5Hash(bucket, key)
      })

      it('should re-fetch the file to verify it', function () {
        expect(S3Client.getObject).to.have.been.calledWith({
          Bucket: bucket,
          Key: key,
        })
      })

      it('should calculate the md5 hash from the file', function () {
        expect(Hash.read).to.have.been.called
      })

      it('should return the md5 hash', function () {
        expect(hash).to.equal(md5)
      })
    })
  })

  describe('copyObject', function () {
    describe('with valid parameters', function () {
      beforeEach(async function () {
        return S3Persistor.copyObject(bucket, key, destKey)
      })

      it('should copy the object', function () {
        expect(S3Client.copyObject).to.have.been.calledWith({
          Bucket: bucket,
          Key: destKey,
          CopySource: `${bucket}/${key}`,
        })
      })
    })

    describe('when the file does not exist', function () {
      let error

      beforeEach(async function () {
        S3Client.copyObject = sinon.stub().returns({
          promise: sinon.stub().rejects(S3NotFoundError),
        })
        try {
          await S3Persistor.copyObject(bucket, key, destKey)
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
        return S3Persistor.deleteObject(bucket, key)
      })

      it('should delete the object', function () {
        expect(S3Client.deleteObject).to.have.been.calledWith({
          Bucket: bucket,
          Key: key,
        })
      })
    })
  })

  describe('deleteDirectory', function () {
    describe('with valid parameters', function () {
      beforeEach(async function () {
        return S3Persistor.deleteDirectory(bucket, key)
      })

      it('should list the objects in the directory', function () {
        expect(S3Client.listObjectsV2).to.have.been.calledWith({
          Bucket: bucket,
          Prefix: key,
        })
      })

      it('should delete the objects using their keys', function () {
        expect(S3Client.deleteObjects).to.have.been.calledWith({
          Bucket: bucket,
          Delete: {
            Objects: [{ Key: 'llama' }, { Key: 'hippo' }],
            Quiet: true,
          },
        })
      })
    })

    describe('when there are no files', function () {
      beforeEach(async function () {
        S3Client.listObjectsV2 = sinon
          .stub()
          .returns({ promise: sinon.stub().resolves({ Contents: [] }) })
        return S3Persistor.deleteDirectory(bucket, key)
      })

      it('should list the objects in the directory', function () {
        expect(S3Client.listObjectsV2).to.have.been.calledWith({
          Bucket: bucket,
          Prefix: key,
        })
      })

      it('should not try to delete any objects', function () {
        expect(S3Client.deleteObjects).not.to.have.been.called
      })
    })

    describe('when there are more files available', function () {
      const continuationToken = 'wombat'
      beforeEach(async function () {
        S3Client.listObjectsV2.onCall(0).returns({
          promise: sinon.stub().resolves({
            Contents: files,
            IsTruncated: true,
            NextContinuationToken: continuationToken,
          }),
        })

        return S3Persistor.deleteDirectory(bucket, key)
      })

      it('should list the objects a second time, with a continuation token', function () {
        expect(S3Client.listObjectsV2).to.be.calledTwice
        expect(S3Client.listObjectsV2).to.be.calledWith({
          Bucket: bucket,
          Prefix: key,
        })
        expect(S3Client.listObjectsV2).to.be.calledWith({
          Bucket: bucket,
          Prefix: key,
          ContinuationToken: continuationToken,
        })
      })

      it('should delete both sets of files', function () {
        expect(S3Client.deleteObjects).to.have.been.calledTwice
      })
    })

    describe('when there is an error listing the objects', function () {
      let error

      beforeEach(async function () {
        S3Client.listObjectsV2 = sinon
          .stub()
          .returns({ promise: sinon.stub().rejects(genericError) })
        try {
          await S3Persistor.deleteDirectory(bucket, key)
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

      it('should not try to delete any objects', function () {
        expect(S3Client.deleteObjects).not.to.have.been.called
      })
    })

    describe('when there is an error deleting the objects', function () {
      let error

      beforeEach(async function () {
        S3Client.deleteObjects = sinon
          .stub()
          .returns({ promise: sinon.stub().rejects(genericError) })
        try {
          await S3Persistor.deleteDirectory(bucket, key)
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
        size = await S3Persistor.directorySize(bucket, key)
      })

      it('should list the objects in the directory', function () {
        expect(S3Client.listObjectsV2).to.have.been.calledWith({
          Bucket: bucket,
          Prefix: key,
        })
      })

      it('should return the directory size', function () {
        expect(size).to.equal(filesSize)
      })
    })

    describe('when there are no files', function () {
      let size

      beforeEach(async function () {
        S3Client.listObjectsV2 = sinon
          .stub()
          .returns({ promise: sinon.stub().resolves({ Contents: [] }) })
        size = await S3Persistor.directorySize(bucket, key)
      })

      it('should list the objects in the directory', function () {
        expect(S3Client.listObjectsV2).to.have.been.calledWith({
          Bucket: bucket,
          Prefix: key,
        })
      })

      it('should return zero', function () {
        expect(size).to.equal(0)
      })
    })

    describe('when there are more files available', function () {
      const continuationToken = 'wombat'
      let size
      beforeEach(async function () {
        S3Client.listObjectsV2.onCall(0).returns({
          promise: sinon.stub().resolves({
            Contents: files,
            IsTruncated: true,
            NextContinuationToken: continuationToken,
          }),
        })

        size = await S3Persistor.directorySize(bucket, key)
      })

      it('should list the objects a second time, with a continuation token', function () {
        expect(S3Client.listObjectsV2).to.be.calledTwice
        expect(S3Client.listObjectsV2).to.be.calledWith({
          Bucket: bucket,
          Prefix: key,
        })
        expect(S3Client.listObjectsV2).to.be.calledWith({
          Bucket: bucket,
          Prefix: key,
          ContinuationToken: continuationToken,
        })
      })

      it('should return the size of both sets of files', function () {
        expect(size).to.equal(filesSize * 2)
      })
    })

    describe('when there is an error listing the objects', function () {
      let error

      beforeEach(async function () {
        S3Client.listObjectsV2 = sinon
          .stub()
          .returns({ promise: sinon.stub().rejects(genericError) })
        try {
          await S3Persistor.directorySize(bucket, key)
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
        exists = await S3Persistor.checkIfObjectExists(bucket, key)
      })

      it('should get the object header', function () {
        expect(S3Client.headObject).to.have.been.calledWith({
          Bucket: bucket,
          Key: key,
        })
      })

      it('should return that the file exists', function () {
        expect(exists).to.equal(true)
      })
    })

    describe('when the file does not exist', function () {
      let exists

      beforeEach(async function () {
        S3Client.headObject = sinon
          .stub()
          .returns({ promise: sinon.stub().rejects(S3NotFoundError) })
        exists = await S3Persistor.checkIfObjectExists(bucket, key)
      })

      it('should get the object header', function () {
        expect(S3Client.headObject).to.have.been.calledWith({
          Bucket: bucket,
          Key: key,
        })
      })

      it('should return that the file does not exist', function () {
        expect(exists).to.equal(false)
      })
    })

    describe('when there is an error', function () {
      let error

      beforeEach(async function () {
        S3Client.headObject = sinon
          .stub()
          .returns({ promise: sinon.stub().rejects(genericError) })
        try {
          await S3Persistor.checkIfObjectExists(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should generate a ReadError', function () {
        expect(error).to.be.an.instanceOf(Errors.ReadError)
      })

      it('should wrap the upstream ReadError', function () {
        expect(error.cause).to.be.an.instanceOf(Errors.ReadError)
      })

      it('should eventually wrap the error', function () {
        expect(error.cause.cause).to.equal(genericError)
      })
    })
  })

  describe('_getClientForBucket', function () {
    it('should return same instance for same bucket', function () {
      const a = S3Persistor._getClientForBucket('foo')
      const b = S3Persistor._getClientForBucket('foo')
      expect(a).to.equal(b)
    })
    it('should return different instance for different bucket', function () {
      const a = S3Persistor._getClientForBucket('foo')
      const b = S3Persistor._getClientForBucket('bar')
      expect(a).to.not.equal(b)
    })
    it('should return different instance for same bucket different computeChecksums', function () {
      const a = S3Persistor._getClientForBucket('foo', false)
      const b = S3Persistor._getClientForBucket('foo', true)
      expect(a).to.not.equal(b)
    })
  })
})
