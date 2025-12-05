const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../src/Errors')
const { EventEmitter } = require('node:events')
const { Readable } = require('node:stream')
const mockS3 = require('./S3ClientMock')

const MODULE_PATH = '../../src/S3Persistor.js'

describe('S3PersistorTests', function () {
  const defaultS3Key = 'frog'
  const defaultS3Secret = 'prince'
  const defaultS3Credentials = {
    credentials: {
      accessKeyId: defaultS3Key,
      secretAccessKey: defaultS3Secret,
    },
    region: 'us-east-1',
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
    awsRequestPresigner,
    nodeHttpHandler,
    awsLibStorage,
    awsLibStorageUpload,
    abortSignal,
    Fs,
    ReadStream,
    Stream,
    StreamPromises,
    S3Persistor,
    S3NotFoundError,
    S3AccessDeniedError,
    FileNotFoundError,
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

    ReadStream = new EventEmitter()

    FileNotFoundError = new Error('File not found')
    FileNotFoundError.code = 'ENOENT'

    Fs = {
      createReadStream: sinon.stub().returns(ReadStream),
    }

    S3NotFoundError = new Error('not found')
    S3NotFoundError.name = 'NoSuchKey'

    S3AccessDeniedError = new Error('access denied')
    S3AccessDeniedError.code = 'AccessDenied'

    S3 = mockS3()

    awsLibStorageUpload = sinon.stub().returns({
      done: sinon.stub().resolves(),
    })

    awsLibStorage = {
      Upload: awsLibStorageUpload,
    }
    awsRequestPresigner = {
      getSignedUrl: sinon.stub().resolves(redirectUrl),
    }

    nodeHttpHandler = {
      NodeHttpHandler: sinon.stub(),
    }

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

    abortSignal = sinon.stub()

    const AbortCtrl = sinon.stub().returns({
      signal: {},
      abort: abortSignal,
    })

    S3Persistor = new (SandboxedModule.require(MODULE_PATH, {
      requires: {
        '@aws-sdk/client-s3': S3,
        '@aws-sdk/lib-storage': awsLibStorage,
        '@aws-sdk/s3-request-presigner': awsRequestPresigner,
        '@overleaf/logger': Logger,
        '@aws-sdk/node-http-handler': nodeHttpHandler,
        './Errors': Errors,
        fs: Fs,
        stream: Stream,
        'stream/promises': StreamPromises,
        crypto,
      },
      globals: { console, Buffer, AbortController: AbortCtrl },
    }).S3Persistor)(settings)
  })

  describe('getObjectStream', function () {
    describe('when called with valid parameters', function () {
      let stream

      beforeEach(async function () {
        S3.mockSend(S3.GetObjectCommand, {
          Body: Readable.from('content'),
          ContentEncoding: 'gzip',
        })
        stream = await S3Persistor.getObjectStream(bucket, key)
      })

      it('returns a PassThrough stream', function () {
        expect(stream).to.be.instanceOf(PassThrough)
      })

      it('fetches the right key from the right bucket', function () {
        S3.assertSendCalledWith(S3.GetObjectCommand, {
          Bucket: bucket,
          Key: key,
        })
      })

      it('pipes the stream through the meter', async function () {
        expect(Stream.pipeline).to.have.been.calledWith(
          sinon.match.instanceOf(Readable),
          sinon.match.instanceOf(Transform),
          sinon.match.instanceOf(PassThrough)
        )
      })

      it('does not abort the request', function () {
        expect(abortSignal).not.to.have.been.called
      })
    })

    describe('when called with a byte range', function () {
      let stream

      beforeEach(async function () {
        S3.mockSend(S3.GetObjectCommand, {
          Body: Readable.from('this is a longer content'),
          ContentEncoding: 'gzip',
        })
        stream = await S3Persistor.getObjectStream(bucket, key, {
          start: 5,
          end: 10,
        })
      })

      it('returns a PassThrough stream', function () {
        expect(stream).to.be.instanceOf(Stream.PassThrough)
      })

      it('passes the byte range on to S3', function () {
        S3.assertSendCalledWith(S3.GetObjectCommand, {
          Bucket: bucket,
          Key: key,
          Range: 'bytes=5-10',
        })
      })
    })

    describe('when streaming fails', function () {
      let stream

      beforeEach(async function () {
        S3.mockSend(S3.GetObjectCommand, {
          Body: Readable.from('content'),
          ContentEncoding: 'gzip',
        })
        Stream.pipeline.yields(new Error())
        stream = await S3Persistor.getObjectStream(bucket, key)
      })

      it('returns a PassThrough stream', function () {
        expect(stream).to.be.instanceOf(Stream.PassThrough)
      })

      it('aborts the request', function () {
        expect(abortSignal).to.have.been.calledOnce
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
        region: 'us-east-1',
      }

      beforeEach(async function () {
        S3.mockSend(S3.GetObjectCommand, {
          Body: Readable.from('content'),
          ContentEncoding: 'gzip',
        })
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
        expect(S3.S3Client).to.have.been.calledWith(alternativeS3Credentials)
      })

      it('fetches the right key from the right bucket', function () {
        S3.assertSendCalledWith(S3.GetObjectCommand, {
          Bucket: bucket,
          Key: key,
        })
      })

      it('uses the default credentials for an unknown bucket', async function () {
        stream = await S3Persistor.getObjectStream('anotherBucket', key)

        expect(S3.S3Client).to.have.been.calledTwice
        expect(S3.S3Client.firstCall).to.have.been.calledWith(
          alternativeS3Credentials
        )
        expect(S3.S3Client.secondCall).to.have.been.calledWith(
          defaultS3Credentials
        )
      })
    })

    describe('without hard-coded credentials', function () {
      it('uses the default provider chain', async function () {
        delete settings.key
        delete settings.secret

        S3.mockSend(S3.GetObjectCommand, {
          Body: Readable.from('content'),
          ContentEncoding: 'gzip',
        })

        await S3Persistor.getObjectStream(bucket, key)
        expect(S3.S3Client).to.have.been.calledOnce
        expect(S3.S3Client.args[0].credentials).to.not.exist
      })
    })

    describe('when given S3 options', function () {
      const httpOptions = { connectionTimeout: 2000 }
      const maxRetries = 2

      beforeEach(async function () {
        settings.httpOptions = httpOptions
        settings.maxRetries = maxRetries

        S3.mockSend(S3.GetObjectCommand, {
          Body: Readable.from('content'),
          ContentEncoding: 'gzip',
        })

        await S3Persistor.getObjectStream(bucket, key)
      })

      it('configures the options and the requestHandler with NodeHttpHandler', function () {
        expect(S3.S3Client).to.have.been.calledWithMatch({
          requestHandler: sinon.match.any,
          maxAttempts: maxRetries + 1,
        })
        expect(nodeHttpHandler.NodeHttpHandler).to.have.been.calledWithMatch(
          httpOptions
        )
      })
    })

    describe("when the file doesn't exist", function () {
      let error, stream

      beforeEach(async function () {
        S3.mockSend(S3.GetObjectCommand, S3NotFoundError, { rejects: true })
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
        S3.mockSend(S3.GetObjectCommand, S3NotFoundError, { rejects: true })
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
        S3.mockSend(S3.GetObjectCommand, S3AccessDeniedError, { rejects: true })
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
        S3.mockSend(S3.GetObjectCommand, genericError, { rejects: true })
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
      expect(awsRequestPresigner.getSignedUrl).to.have.been.called
    })

    it('should return the url', function () {
      expect(signedUrl).to.equal(redirectUrl)
    })
  })

  describe('getObjectSize', function () {
    describe('when called with valid parameters', function () {
      let size

      beforeEach(async function () {
        S3.mockSend(S3.HeadObjectCommand, { ContentLength: objectSize })
        size = await S3Persistor.getObjectSize(bucket, key)
      })

      it('should return the object size', function () {
        expect(size).to.equal(objectSize)
      })

      it('should pass the bucket and key to S3', function () {
        S3.assertSendCalledWith(S3.HeadObjectCommand, {
          Bucket: bucket,
          Key: key,
        })
      })
    })

    describe('when the object is not found', function () {
      let error

      beforeEach(async function () {
        S3.mockSend(S3.HeadObjectCommand, S3NotFoundError, { rejects: true })
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
        S3.mockSend(S3.HeadObjectCommand, genericError, { rejects: true })
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
        await S3Persistor.sendStream(bucket, key, ReadStream)
      })

      it('should upload the stream in a single part', function () {
        expect(awsLibStorageUpload).to.have.been.calledWith({
          client: S3.s3ClientStub,
          params: {
            Bucket: bucket,
            Key: key,
            Body: sinon.match.instanceOf(Stream.Transform),
          },
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

    describe('when metadata is supplied', function () {
      const contentType = 'text/csv'
      const contentEncoding = 'gzip'

      beforeEach(async function () {
        await S3Persistor.sendStream(bucket, key, ReadStream, {
          contentType,
          contentEncoding,
        })
      })

      it('sends the metadata to S3', function () {
        expect(awsLibStorageUpload).to.have.been.calledWith({
          client: S3.s3ClientStub,
          params: {
            Bucket: bucket,
            Key: key,
            Body: sinon.match.instanceOf(Transform),
            ContentType: contentType,
            ContentEncoding: contentEncoding,
          },
          partSize: 100 * 1024 * 1024,
        })
      })
    })

    describe('with sourceMd5 option', function () {
      let error
      beforeEach(async function () {
        try {
          await S3Persistor.sendStream(bucket, key, ReadStream, {
            sourceMd5: 'ffffffff',
          })
        } catch (err) {
          error = err
        }
      })

      it('should throw an error', function () {
        expect(error.message).to.equal('upload to S3 failed')
        expect(error.cause.message).to.equal(
          'sourceMd5 option is not supported, S3 provides its own integrity protection mechanism'
        )
      })
    })

    describe('when the upload fails', function () {
      let error
      beforeEach(async function () {
        awsLibStorageUpload.rejects(genericError)
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
        S3.s3ClientStub.send.resolves()
        await S3Persistor.sendFile(bucket, key, filename)
      })

      it('should create a read stream for the file', function () {
        expect(Fs.createReadStream).to.have.been.calledWith(filename)
      })

      it('should upload the stream', function () {
        expect(awsLibStorageUpload).to.have.been.calledWith({
          client: S3.s3ClientStub,
          params: {
            Bucket: bucket,
            Key: key,
            Body: sinon.match.instanceOf(Transform),
          },
          partSize: settings.partSize,
        })
      })
    })
  })

  describe('getObjectMd5Hash', function () {
    describe('when the etag is a valid md5 hash', function () {
      let hash
      beforeEach(async function () {
        S3.mockSend(S3.HeadObjectCommand, {
          ContentLength: objectSize,
          ETag: md5,
        })
        hash = await S3Persistor.getObjectMd5Hash(bucket, key)
      })

      it('should return the object hash', function () {
        expect(hash).to.equal(md5)
      })

      it('should get the hash from the object metadata', function () {
        S3.assertSendCalledWith(S3.HeadObjectCommand, {
          Bucket: bucket,
          Key: key,
        })
      })

      it('should not download the object', function () {
        S3.assertSendNotCalledWith(S3.GetObjectCommand)
      })
    })

    describe("when the etag isn't a valid md5 hash", function () {
      let hash
      beforeEach(async function () {
        S3.mockSend(S3.GetObjectCommand, {
          ContentLength: objectSize,
          ETag: md5,
        })
        S3.mockSend(S3.HeadObjectCommand, {
          ETag: 'somethingthatisntanmd5',
          Bucket: bucket,
          Key: key,
        })
        hash = await S3Persistor.getObjectMd5Hash(bucket, key)
      })

      it('should re-fetch the file to verify it', function () {
        S3.assertSendCalledWith(S3.GetObjectCommand, {
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
        S3.mockSend(S3.CopyObjectCommand)
        await S3Persistor.copyObject(bucket, key, destKey)
      })

      it('should copy the object', function () {
        S3.assertSendCalledWith(S3.CopyObjectCommand, {
          Bucket: bucket,
          Key: destKey,
          CopySource: `/${bucket}/${key}`,
        })
      })
    })

    describe('when the file does not exist', function () {
      let error

      beforeEach(async function () {
        S3.mockSend(S3.CopyObjectCommand, S3NotFoundError, { rejects: true })
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
        S3.mockSend(S3.DeleteObjectCommand)
        await S3Persistor.deleteObject(bucket, key)
      })

      it('should delete the object', function () {
        S3.assertSendCalledWith(S3.DeleteObjectCommand, {
          Bucket: bucket,
          Key: key,
        })
      })
    })
  })

  describe('deleteDirectory', function () {
    describe('with valid parameters', function () {
      beforeEach(async function () {
        S3.mockSend(S3.ListObjectsV2Command, { Contents: files })
        await S3Persistor.deleteDirectory(bucket, key)
      })

      it('should list the objects in the directory', function () {
        S3.assertSendCalledWith(S3.ListObjectsV2Command, {
          Bucket: bucket,
          Prefix: key,
        })
      })

      it('should delete the objects using their keys', function () {
        S3.s3ClientStub.send.withArgs(new S3.DeleteObjectsCommand()).resolves()
        S3.assertSendCalledWith(
          S3.DeleteObjectsCommand,
          {
            Bucket: bucket,
            Delete: {
              Objects: [{ Key: 'llama' }, { Key: 'hippo' }],
              Quiet: true,
            },
          },
          1
        )
      })
    })

    describe('when there are no files', function () {
      beforeEach(async function () {
        S3.mockSend(S3.ListObjectsV2Command, { Contents: [] })
        await S3Persistor.deleteDirectory(bucket, key)
      })

      it('should list the objects in the directory', function () {
        S3.assertSendCalledWith(S3.ListObjectsV2Command, {
          Bucket: bucket,
          Prefix: key,
        })
      })

      it('should not try to delete any objects', function () {
        S3.assertSendNotCalledWith(S3.DeleteObjectsCommand)
      })
    })

    describe('when there are more files available', function () {
      const continuationToken = 'wombat'
      beforeEach(async function () {
        S3.mockSend(
          S3.ListObjectsV2Command,
          {
            Contents: files,
            IsTruncated: true,
            NextContinuationToken: continuationToken,
          },
          {
            nextResponses: [{ Contents: [{ Key: 'last-file', Size: 33 }] }],
          }
        )
        S3.mockSend(S3.DeleteObjectsCommand)
        return S3Persistor.deleteDirectory(bucket, key)
      })

      it('should list the objects a second time, with a continuation token', function () {
        S3.assertSendCallCount(S3.ListObjectsV2Command, 2)
        expect(S3.s3ClientStub.send.firstCall.args[0].payload).to.deep.equal({
          Bucket: bucket,
          Prefix: key,
        })
        expect(S3.s3ClientStub.send.thirdCall.args[0].payload).to.deep.equal({
          Bucket: bucket,
          Prefix: key,
          ContinuationToken: continuationToken,
        })
      })

      it('should delete both sets of files', function () {
        S3.assertSendCallCount(S3.DeleteObjectsCommand, 2)
      })
    })

    describe('when there is an error listing the objects', function () {
      let error

      beforeEach(async function () {
        S3.mockSend(S3.ListObjectsV2Command, genericError, { rejects: true })
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
        // call count should be 1, only the ListObjectsV2Command tested above
        expect(S3.s3ClientStub.send.callCount).to.equal(1)
      })
    })

    describe('when there is an error deleting the objects', function () {
      let error

      beforeEach(async function () {
        S3.mockSend(S3.ListObjectsV2Command, { Contents: files })
        S3.mockSend(S3.DeleteObjectsCommand, genericError, { rejects: true })
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
        S3.mockSend(S3.ListObjectsV2Command, { Contents: files })
        size = await S3Persistor.directorySize(bucket, key)
      })

      it('should list the objects in the directory', function () {
        S3.assertSendCalledWith(S3.ListObjectsV2Command, {
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
        S3.mockSend(S3.ListObjectsV2Command, { Contents: [] })
        size = await S3Persistor.directorySize(bucket, key)
      })

      it('should list the objects in the directory', function () {
        S3.assertSendCalledWith(S3.ListObjectsV2Command, {
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
        S3.mockSend(
          S3.ListObjectsV2Command,
          {
            Contents: files,
            IsTruncated: true,
            NextContinuationToken: continuationToken,
          },
          {
            nextResponses: [{ Contents: [{ Key: 'last-file', Size: 33 }] }],
          }
        )

        size = await S3Persistor.directorySize(bucket, key)
      })

      it('should list the objects a second time, with a continuation token', function () {
        S3.assertSendCallCount(S3.ListObjectsV2Command, 2)
        expect(S3.s3ClientStub.send.firstCall.args[0].payload).to.deep.equal({
          Bucket: bucket,
          Prefix: key,
        })
        expect(S3.s3ClientStub.send.secondCall.args[0].payload).to.deep.equal({
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
        S3.mockSend(S3.ListObjectsV2Command, genericError, { rejects: true })
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
        S3.mockSend(S3.HeadObjectCommand, { ContentLength: objectSize })
        exists = await S3Persistor.checkIfObjectExists(bucket, key)
      })

      it('should get the object header', function () {
        S3.assertSendCalledWith(S3.HeadObjectCommand, {
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
        S3.mockSend(S3.HeadObjectCommand, S3NotFoundError, { rejects: true })
        S3.s3ClientStub.send.rejects(S3NotFoundError)
        exists = await S3Persistor.checkIfObjectExists(bucket, key)
      })

      it('should get the object header', function () {
        S3.assertSendCalledWith(S3.HeadObjectCommand, {
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
        S3.mockSend(S3.HeadObjectCommand, genericError, { rejects: true })
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

  describe('listDirectoryKeys', function () {
    describe('with valid parameters', function () {
      let keys

      beforeEach(async function () {
        S3.mockSend(S3.ListObjectsV2Command, {
          Contents: files.map(file => ({ Key: file.Key })),
          IsTruncated: false,
        })
        keys = await S3Persistor.listDirectoryKeys(bucket, key)
      })

      it('should list the objects in the directory', function () {
        S3.assertSendCalledWith(S3.ListObjectsV2Command, {
          Bucket: bucket,
          Prefix: key,
        })
      })

      it('should return the keys', function () {
        expect(keys).to.deep.equal(['llama', 'hippo'])
      })
    })

    describe('when there are no files', function () {
      let keys

      beforeEach(async function () {
        S3.mockSend(S3.ListObjectsV2Command, {
          Contents: [],
          IsTruncated: false,
        })
        keys = await S3Persistor.listDirectoryKeys(bucket, key)
      })

      it('should return an empty array', function () {
        expect(keys).to.deep.equal([])
      })
    })

    describe('when there are more files available', function () {
      const continuationToken = 'wombat'
      let keys

      beforeEach(async function () {
        S3.mockSend(
          S3.ListObjectsV2Command,
          {
            Contents: [files[0]].map(file => ({ Key: file.Key })),
            IsTruncated: true,
            NextContinuationToken: continuationToken,
          },
          {
            nextResponses: [
              {
                Contents: [files[1]].map(file => ({ Key: file.Key })),
                IsTruncated: false,
              },
            ],
          }
        )
        keys = await S3Persistor.listDirectoryKeys(bucket, key)
      })

      it('should list the objects in multiple calls', function () {
        S3.assertSendCallCount(S3.ListObjectsV2Command, 2)
        expect(S3.s3ClientStub.send.firstCall.args[0].payload).to.deep.equal({
          Bucket: bucket,
          Prefix: key,
        })
        expect(S3.s3ClientStub.send.secondCall.args[0].payload).to.deep.equal({
          Bucket: bucket,
          Prefix: key,
          ContinuationToken: continuationToken,
        })
      })

      it('should return all keys', function () {
        expect(keys).to.deep.equal(['llama', 'hippo'])
      })
    })

    describe('when there is an error listing the objects', function () {
      let error

      beforeEach(async function () {
        S3.mockSend(S3.ListObjectsV2Command, genericError, { rejects: true })
        try {
          await S3Persistor.listDirectoryKeys(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should generate a ReadError', function () {
        expect(error).to.be.an.instanceOf(Errors.ReadError)
      })

      it('should wrap the error', function () {
        expect(error.cause).to.exist
      })
    })
  })

  describe('listDirectoryStats', function () {
    describe('with valid parameters', function () {
      let stats

      beforeEach(async function () {
        S3.mockSend(S3.ListObjectsV2Command, {
          Contents: files.map(file => ({ Key: file.Key, Size: file.Size })),
          IsTruncated: false,
        })
        stats = await S3Persistor.listDirectoryStats(bucket, key)
      })

      it('should list the objects in the directory', function () {
        S3.assertSendCalledWith(S3.ListObjectsV2Command, {
          Bucket: bucket,
          Prefix: key,
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
        S3.mockSend(S3.ListObjectsV2Command, {
          Contents: [],
          IsTruncated: false,
        })
        stats = await S3Persistor.listDirectoryStats(bucket, key)
      })

      it('should return an empty array', function () {
        expect(stats).to.deep.equal([])
      })
    })

    describe('when there are more files available', function () {
      const continuationToken = 'wombat'
      let stats

      beforeEach(async function () {
        S3.mockSend(
          S3.ListObjectsV2Command,
          {
            Contents: [files[0]].map(file => ({
              Key: file.Key,
              Size: file.Size,
            })),
            IsTruncated: true,
            NextContinuationToken: continuationToken,
          },
          {
            nextResponses: [
              {
                Contents: [files[1]].map(file => ({
                  Key: file.Key,
                  Size: file.Size,
                })),
                IsTruncated: false,
              },
            ],
          }
        )
        stats = await S3Persistor.listDirectoryStats(bucket, key)
      })

      it('should list the objects in multiple calls', function () {
        S3.assertSendCallCount(S3.ListObjectsV2Command, 2)
      })

      it('should return all stats', function () {
        expect(stats).to.deep.equal([
          { key: 'llama', size: 11 },
          { key: 'hippo', size: 22 },
        ])
      })
    })

    describe('when there is an error listing the objects', function () {
      let error

      beforeEach(async function () {
        S3.mockSend(S3.ListObjectsV2Command, genericError, { rejects: true })
        try {
          await S3Persistor.listDirectoryStats(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should generate a ReadError', function () {
        expect(error).to.be.an.instanceOf(Errors.ReadError)
      })

      it('should wrap the error', function () {
        expect(error.cause).to.exist
      })
    })
  })
})
