const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const modulePath = '../../../app/js/S3Persistor.js'
const SandboxedModule = require('sandboxed-module')

const Errors = require('../../../app/js/Errors')

describe('S3PersistorTests', function() {
  const defaultS3Key = 'frog'
  const defaultS3Secret = 'prince'
  const defaultS3Credentials = {
    credentials: {
      accessKeyId: defaultS3Key,
      secretAccessKey: defaultS3Secret
    }
  }
  const filename = '/wombat/potato.tex'
  const bucket = 'womBucket'
  const key = 'monKey'
  const destKey = 'donKey'
  const objectSize = 5555
  const genericError = new Error('guru meditation error')
  const files = [
    { Key: 'llama', Size: 11 },
    { Key: 'hippo', Size: 22 }
  ]
  const filesSize = 33
  const md5 = 'ffffffff00000000ffffffff00000000'

  let Metrics,
    Logger,
    Transform,
    S3,
    Fs,
    ReadStream,
    Stream,
    S3Persistor,
    S3Client,
    S3ReadStream,
    S3NotFoundError,
    S3AccessDeniedError,
    FileNotFoundError,
    EmptyPromise,
    settings,
    Hash,
    crypto

  beforeEach(function() {
    settings = {
      filestore: {
        backend: 's3',
        s3: {
          secret: defaultS3Secret,
          key: defaultS3Key,
          partSize: 100 * 1024 * 1024
        },
        stores: {
          user_files: 'sl_user_files'
        }
      }
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

    EmptyPromise = {
      promise: sinon.stub().resolves()
    }

    Metrics = {
      count: sinon.stub()
    }

    ReadStream = {
      pipe: sinon.stub().returns('readStream'),
      on: sinon
        .stub()
        .withArgs('end')
        .yields()
    }

    FileNotFoundError = new Error('File not found')
    FileNotFoundError.code = 'ENOENT'

    Fs = {
      createReadStream: sinon.stub().returns(ReadStream)
    }

    S3NotFoundError = new Error('not found')
    S3NotFoundError.code = 'NoSuchKey'

    S3AccessDeniedError = new Error('access denied')
    S3AccessDeniedError.code = 'AccessDenied'

    S3ReadStream = {
      on: sinon.stub(),
      pipe: sinon.stub(),
      removeListener: sinon.stub()
    }
    S3Client = {
      getObject: sinon.stub().returns({
        createReadStream: sinon.stub().returns(S3ReadStream)
      }),
      headObject: sinon.stub().returns({
        promise: sinon.stub().resolves({
          ContentLength: objectSize,
          ETag: md5
        })
      }),
      listObjects: sinon.stub().returns({
        promise: sinon.stub().resolves({
          Contents: files
        })
      }),
      upload: sinon
        .stub()
        .returns({ promise: sinon.stub().resolves({ ETag: `"${md5}"` }) }),
      copyObject: sinon.stub().returns(EmptyPromise),
      deleteObject: sinon.stub().returns(EmptyPromise),
      deleteObjects: sinon.stub().returns(EmptyPromise)
    }
    S3 = sinon.stub().returns(S3Client)

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

    S3Persistor = SandboxedModule.require(modulePath, {
      requires: {
        'aws-sdk/clients/s3': S3,
        'settings-sharelatex': settings,
        'logger-sharelatex': Logger,
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
        stream = await S3Persistor.promises.getFileStream(bucket, key)
      })

      it('returns a metered stream', function() {
        expect(stream).to.be.instanceOf(Transform)
      })

      it('sets the AWS client up with credentials from settings', function() {
        expect(S3).to.have.been.calledWith(defaultS3Credentials)
      })

      it('fetches the right key from the right bucket', function() {
        expect(S3Client.getObject).to.have.been.calledWith({
          Bucket: bucket,
          Key: key
        })
      })

      it('pipes the stream through the meter', function() {
        expect(Stream.pipeline).to.have.been.calledWith(
          S3ReadStream,
          sinon.match.instanceOf(Transform)
        )
      })
    })

    describe('when called with a byte range', function() {
      let stream

      beforeEach(async function() {
        stream = await S3Persistor.promises.getFileStream(bucket, key, {
          start: 5,
          end: 10
        })
      })

      it('returns a metered stream', function() {
        expect(stream).to.be.instanceOf(Stream.Transform)
      })

      it('passes the byte range on to S3', function() {
        expect(S3Client.getObject).to.have.been.calledWith({
          Bucket: bucket,
          Key: key,
          Range: 'bytes=5-10'
        })
      })
    })

    describe('when there are alternative credentials', function() {
      let stream
      const alternativeSecret = 'giraffe'
      const alternativeKey = 'hippo'
      const alternativeS3Credentials = {
        credentials: {
          accessKeyId: alternativeKey,
          secretAccessKey: alternativeSecret
        }
      }

      beforeEach(async function() {
        settings.filestore.s3BucketCreds = {}
        settings.filestore.s3BucketCreds[bucket] = {
          auth_key: alternativeKey,
          auth_secret: alternativeSecret
        }

        stream = await S3Persistor.promises.getFileStream(bucket, key)
      })

      it('returns a metered stream', function() {
        expect(stream).to.be.instanceOf(Stream.Transform)
      })

      it('sets the AWS client up with the alternative credentials', function() {
        expect(S3).to.have.been.calledWith(alternativeS3Credentials)
      })

      it('fetches the right key from the right bucket', function() {
        expect(S3Client.getObject).to.have.been.calledWith({
          Bucket: bucket,
          Key: key
        })
      })

      it('caches the credentials', async function() {
        stream = await S3Persistor.promises.getFileStream(bucket, key)

        expect(S3).to.have.been.calledOnceWith(alternativeS3Credentials)
      })

      it('uses the default credentials for an unknown bucket', async function() {
        stream = await S3Persistor.promises.getFileStream('anotherBucket', key)

        expect(S3).to.have.been.calledTwice
        expect(S3.firstCall).to.have.been.calledWith(alternativeS3Credentials)
        expect(S3.secondCall).to.have.been.calledWith(defaultS3Credentials)
      })

      it('caches the default credentials', async function() {
        stream = await S3Persistor.promises.getFileStream('anotherBucket', key)
        stream = await S3Persistor.promises.getFileStream('anotherBucket', key)

        expect(S3).to.have.been.calledTwice
        expect(S3.firstCall).to.have.been.calledWith(alternativeS3Credentials)
        expect(S3.secondCall).to.have.been.calledWith(defaultS3Credentials)
      })

      it('throws an error if there are no credentials for the bucket', async function() {
        delete settings.filestore.s3.key
        delete settings.filestore.s3.secret

        await expect(
          S3Persistor.promises.getFileStream('anotherBucket', key)
        ).to.eventually.be.rejected.and.be.an.instanceOf(Errors.SettingsError)
      })
    })

    describe("when the file doesn't exist", function() {
      let error, stream

      beforeEach(async function() {
        Transform.prototype.on = sinon.stub()
        Stream.pipeline.yields(S3NotFoundError)
        try {
          stream = await S3Persistor.promises.getFileStream(bucket, key)
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

    describe('when access to the file is denied', function() {
      let error, stream

      beforeEach(async function() {
        Transform.prototype.on = sinon.stub()
        Stream.pipeline.yields(S3AccessDeniedError)
        try {
          stream = await S3Persistor.promises.getFileStream(bucket, key)
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

    describe('when S3 encounters an unkown error', function() {
      let error, stream

      beforeEach(async function() {
        Transform.prototype.on = sinon.stub()
        Stream.pipeline.yields(genericError)
        try {
          stream = await S3Persistor.promises.getFileStream(bucket, key)
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
        size = await S3Persistor.promises.getFileSize(bucket, key)
      })

      it('should return the object size', function() {
        expect(size).to.equal(objectSize)
      })

      it('should pass the bucket and key to S3', function() {
        expect(S3Client.headObject).to.have.been.calledWith({
          Bucket: bucket,
          Key: key
        })
      })
    })

    describe('when the object is not found', function() {
      let error

      beforeEach(async function() {
        S3Client.headObject = sinon.stub().returns({
          promise: sinon.stub().rejects(S3NotFoundError)
        })
        try {
          await S3Persistor.promises.getFileSize(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should return a NotFoundError', function() {
        expect(error).to.be.an.instanceOf(Errors.NotFoundError)
      })

      it('should wrap the error', function() {
        expect(error.cause).to.equal(S3NotFoundError)
      })
    })

    describe('when S3 returns an error', function() {
      let error

      beforeEach(async function() {
        S3Client.headObject = sinon.stub().returns({
          promise: sinon.stub().rejects(genericError)
        })
        try {
          await S3Persistor.promises.getFileSize(bucket, key)
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
        return S3Persistor.promises.sendStream(bucket, key, ReadStream)
      })

      it('should upload the stream', function() {
        expect(S3Client.upload).to.have.been.calledWith({
          Bucket: bucket,
          Key: key,
          Body: sinon.match.instanceOf(Stream.Transform)
        })
      })

      it('should upload files in a single part', function() {
        expect(S3Client.upload).to.have.been.calledWith(sinon.match.any, {
          partSize: 100 * 1024 * 1024
        })
      })

      it('should meter the stream', function() {
        expect(Stream.pipeline).to.have.been.calledWith(
          ReadStream,
          sinon.match.instanceOf(Stream.Transform)
        )
      })

      it('calculates the md5 hash of the file', function() {
        expect(Hash.digest).to.have.been.called
      })
    })

    describe('when a hash is supploed', function() {
      beforeEach(async function() {
        return S3Persistor.promises.sendStream(
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
        expect(S3Client.upload).to.have.been.calledWith({
          Bucket: bucket,
          Key: key,
          Body: sinon.match.instanceOf(Transform),
          ContentMD5: 'qqqqqru7u7uqqqqqu7u7uw=='
        })
      })

      it('does not fetch the md5 hash of the uploaded file', function() {
        expect(S3Client.headObject).not.to.have.been.called
      })
    })

    describe('when the upload fails', function() {
      let error
      beforeEach(async function() {
        S3Client.upload = sinon.stub().returns({
          promise: sinon.stub().rejects(genericError)
        })
        try {
          await S3Persistor.promises.sendStream(bucket, key, ReadStream)
        } catch (err) {
          error = err
        }
      })

      it('throws a WriteError', function() {
        expect(error).to.be.an.instanceOf(Errors.WriteError)
      })
    })

    describe("when the etag isn't a valid md5 hash", function() {
      beforeEach(async function() {
        S3Client.upload = sinon.stub().returns({
          promise: sinon.stub().resolves({
            ETag: 'somethingthatisntanmd5',
            Bucket: bucket,
            Key: key
          })
        })

        await S3Persistor.promises.sendStream(bucket, key, ReadStream)
      })

      it('should re-fetch the file to verify it', function() {
        expect(S3Client.getObject).to.have.been.calledWith({
          Bucket: bucket,
          Key: key
        })
      })

      it('should meter the download', function() {
        expect(Stream.pipeline).to.have.been.calledWith(
          S3ReadStream,
          sinon.match.instanceOf(Stream.Transform)
        )
      })

      it('should calculate the md5 hash from the file', function() {
        expect(Hash.digest).to.have.been.called
      })
    })
  })

  describe('sendFile', function() {
    describe('with valid parameters', function() {
      beforeEach(async function() {
        return S3Persistor.promises.sendFile(bucket, key, filename)
      })

      it('should create a read stream for the file', function() {
        expect(Fs.createReadStream).to.have.been.calledWith(filename)
      })

      it('should upload the stream', function() {
        expect(S3Client.upload).to.have.been.calledWith({
          Bucket: bucket,
          Key: key,
          Body: sinon.match.instanceOf(Transform)
        })
      })
    })
  })

  describe('copyFile', function() {
    describe('with valid parameters', function() {
      beforeEach(async function() {
        return S3Persistor.promises.copyFile(bucket, key, destKey)
      })

      it('should copy the object', function() {
        expect(S3Client.copyObject).to.have.been.calledWith({
          Bucket: bucket,
          Key: destKey,
          CopySource: `${bucket}/${key}`
        })
      })
    })

    describe('when the file does not exist', function() {
      let error

      beforeEach(async function() {
        S3Client.copyObject = sinon.stub().returns({
          promise: sinon.stub().rejects(S3NotFoundError)
        })
        try {
          await S3Persistor.promises.copyFile(bucket, key, destKey)
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
        return S3Persistor.promises.deleteFile(bucket, key)
      })

      it('should delete the object', function() {
        expect(S3Client.deleteObject).to.have.been.calledWith({
          Bucket: bucket,
          Key: key
        })
      })
    })
  })

  describe('deleteDirectory', function() {
    describe('with valid parameters', function() {
      beforeEach(async function() {
        return S3Persistor.promises.deleteDirectory(bucket, key)
      })

      it('should list the objects in the directory', function() {
        expect(S3Client.listObjects).to.have.been.calledWith({
          Bucket: bucket,
          Prefix: key
        })
      })

      it('should delete the objects using their keys', function() {
        expect(S3Client.deleteObjects).to.have.been.calledWith({
          Bucket: bucket,
          Delete: {
            Objects: [{ Key: 'llama' }, { Key: 'hippo' }],
            Quiet: true
          }
        })
      })
    })

    describe('when there are no files', function() {
      beforeEach(async function() {
        S3Client.listObjects = sinon
          .stub()
          .returns({ promise: sinon.stub().resolves({ Contents: [] }) })
        return S3Persistor.promises.deleteDirectory(bucket, key)
      })

      it('should list the objects in the directory', function() {
        expect(S3Client.listObjects).to.have.been.calledWith({
          Bucket: bucket,
          Prefix: key
        })
      })

      it('should not try to delete any objects', function() {
        expect(S3Client.deleteObjects).not.to.have.been.called
      })
    })

    describe('when there is an error listing the objects', function() {
      let error

      beforeEach(async function() {
        S3Client.listObjects = sinon
          .stub()
          .returns({ promise: sinon.stub().rejects(genericError) })
        try {
          await S3Persistor.promises.deleteDirectory(bucket, key)
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

      it('should not try to delete any objects', function() {
        expect(S3Client.deleteObjects).not.to.have.been.called
      })
    })

    describe('when there is an error deleting the objects', function() {
      let error

      beforeEach(async function() {
        S3Client.deleteObjects = sinon
          .stub()
          .returns({ promise: sinon.stub().rejects(genericError) })
        try {
          await S3Persistor.promises.deleteDirectory(bucket, key)
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
        size = await S3Persistor.promises.directorySize(bucket, key)
      })

      it('should list the objects in the directory', function() {
        expect(S3Client.listObjects).to.have.been.calledWith({
          Bucket: bucket,
          Prefix: key
        })
      })

      it('should return the directory size', function() {
        expect(size).to.equal(filesSize)
      })
    })

    describe('when there are no files', function() {
      let size

      beforeEach(async function() {
        S3Client.listObjects = sinon
          .stub()
          .returns({ promise: sinon.stub().resolves({ Contents: [] }) })
        size = await S3Persistor.promises.directorySize(bucket, key)
      })

      it('should list the objects in the directory', function() {
        expect(S3Client.listObjects).to.have.been.calledWith({
          Bucket: bucket,
          Prefix: key
        })
      })

      it('should return zero', function() {
        expect(size).to.equal(0)
      })
    })

    describe('when there is an error listing the objects', function() {
      let error

      beforeEach(async function() {
        S3Client.listObjects = sinon
          .stub()
          .returns({ promise: sinon.stub().rejects(genericError) })
        try {
          await S3Persistor.promises.directorySize(bucket, key)
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
        exists = await S3Persistor.promises.checkIfFileExists(bucket, key)
      })

      it('should get the object header', function() {
        expect(S3Client.headObject).to.have.been.calledWith({
          Bucket: bucket,
          Key: key
        })
      })

      it('should return that the file exists', function() {
        expect(exists).to.equal(true)
      })
    })

    describe('when the file does not exist', function() {
      let exists

      beforeEach(async function() {
        S3Client.headObject = sinon
          .stub()
          .returns({ promise: sinon.stub().rejects(S3NotFoundError) })
        exists = await S3Persistor.promises.checkIfFileExists(bucket, key)
      })

      it('should get the object header', function() {
        expect(S3Client.headObject).to.have.been.calledWith({
          Bucket: bucket,
          Key: key
        })
      })

      it('should return that the file does not exist', function() {
        expect(exists).to.equal(false)
      })
    })

    describe('when there is an error', function() {
      let error

      beforeEach(async function() {
        S3Client.headObject = sinon
          .stub()
          .returns({ promise: sinon.stub().rejects(genericError) })
        try {
          await S3Persistor.promises.checkIfFileExists(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should generate a ReadError', function() {
        expect(error).to.be.an.instanceOf(Errors.ReadError)
      })

      it('should wrap the upstream ReadError', function() {
        expect(error.cause).to.be.an.instanceOf(Errors.ReadError)
      })

      it('should eventually wrap the error', function() {
        expect(error.cause.cause).to.equal(genericError)
      })
    })
  })
})
