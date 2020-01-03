const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const modulePath = '../../../app/js/S3PersistorManager.js'
const SandboxedModule = require('sandboxed-module')

const Errors = require('../../../app/js/Errors')

describe('S3PersistorManagerTests', function() {
  const settings = {
    filestore: {
      backend: 's3',
      s3: {
        secret: 'secret',
        key: 'this_key'
      },
      stores: {
        user_files: 'sl_user_files'
      }
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

  let Metrics,
    S3,
    Fs,
    Meter,
    MeteredStream,
    ReadStream,
    S3PersistorManager,
    S3Client,
    S3ReadStream,
    S3NotFoundError,
    FileNotFoundError,
    EmptyPromise

  beforeEach(function() {
    EmptyPromise = {
      promise: sinon.stub().resolves()
    }

    Metrics = {
      count: sinon.stub()
    }

    ReadStream = {
      pipe: sinon.stub().returns('readStream')
    }

    FileNotFoundError = new Error('File not found')
    FileNotFoundError.code = 'ENOENT'

    Fs = {
      createReadStream: sinon.stub().returns(ReadStream)
    }

    MeteredStream = {
      on: sinon.stub(),
      bytes: objectSize
    }
    MeteredStream.on.withArgs('finish').yields()
    Meter = sinon.stub().returns(MeteredStream)

    S3NotFoundError = new Error('not found')
    S3NotFoundError.code = 'NoSuchKey'

    S3ReadStream = {
      on: sinon.stub(),
      pipe: sinon.stub().returns('s3Stream'),
      removeListener: sinon.stub()
    }
    S3ReadStream.on.withArgs('readable').yields()
    S3Client = {
      getObject: sinon.stub().returns({
        createReadStream: sinon.stub().returns(S3ReadStream)
      }),
      headObject: sinon.stub().returns({
        promise: sinon.stub().resolves({
          ContentLength: objectSize
        })
      }),
      listObjects: sinon.stub().returns({
        promise: sinon.stub().resolves({
          Contents: files
        })
      }),
      upload: sinon.stub().returns(EmptyPromise),
      copyObject: sinon.stub().returns(EmptyPromise),
      deleteObject: sinon.stub().returns(EmptyPromise),
      deleteObjects: sinon.stub().returns(EmptyPromise)
    }
    S3 = sinon.stub().returns(S3Client)

    S3PersistorManager = SandboxedModule.require(modulePath, {
      requires: {
        'aws-sdk/clients/s3': S3,
        'settings-sharelatex': settings,
        './Errors': Errors,
        fs: Fs,
        'stream-meter': Meter,
        'logger-sharelatex': {
          log() {},
          err() {}
        },
        'metrics-sharelatex': Metrics
      },
      globals: { console }
    })
  })

  describe('getFileStream', function() {
    describe('when called with valid parameters', function() {
      let stream

      beforeEach(async function() {
        stream = await S3PersistorManager.promises.getFileStream(bucket, key)
      })

      it('returns a stream', function() {
        expect(stream).to.equal('s3Stream')
      })

      it('sets the AWS client up with credentials from settings', function() {
        expect(S3).to.have.been.calledWith({
          credentials: {
            accessKeyId: settings.filestore.s3.key,
            secretAccessKey: settings.filestore.s3.secret
          }
        })
      })

      it('fetches the right key from the right bucket', function() {
        expect(S3Client.getObject).to.have.been.calledWith({
          Bucket: bucket,
          Key: key
        })
      })

      it('pipes the stream through the meter', function() {
        expect(S3ReadStream.pipe).to.have.been.calledWith(MeteredStream)
      })

      it('records an ingress metric', function() {
        expect(Metrics.count).to.have.been.calledWith('s3.ingress', objectSize)
      })
    })

    describe('when called with a byte range', function() {
      let stream

      beforeEach(async function() {
        stream = await S3PersistorManager.promises.getFileStream(bucket, key, {
          start: 5,
          end: 10
        })
      })

      it('returns a stream', function() {
        expect(stream).to.equal('s3Stream')
      })

      it('passes the byte range on to S3', function() {
        expect(S3Client.getObject).to.have.been.calledWith({
          Bucket: bucket,
          Key: key,
          Range: 'bytes=5-10'
        })
      })
    })

    describe("when the file doesn't exist", function() {
      let error, stream

      beforeEach(async function() {
        S3ReadStream.on = sinon.stub()
        S3ReadStream.on.withArgs('error').yields(S3NotFoundError)
        try {
          stream = await S3PersistorManager.promises.getFileStream(bucket, key)
          console.log(stream)
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

      it('wraps the error from S3', function() {
        expect(error.cause).to.equal(S3NotFoundError)
      })

      it('stores the bucket and key in the error', function() {
        expect(error.info).to.deep.equal({ Bucket: bucket, Key: key })
      })
    })

    describe('when S3 encounters an unkown error', function() {
      let error, stream

      beforeEach(async function() {
        S3ReadStream.on = sinon.stub()
        S3ReadStream.on.withArgs('error').yields(genericError)
        try {
          stream = await S3PersistorManager.promises.getFileStream(bucket, key)
          console.log(stream)
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

      it('wraps the error from S3', function() {
        expect(error.cause).to.equal(genericError)
      })

      it('stores the bucket and key in the error', function() {
        expect(error.info).to.deep.equal({ Bucket: bucket, Key: key })
      })
    })
  })

  describe('getFileSize', function() {
    describe('when called with valid parameters', function() {
      let size

      beforeEach(async function() {
        size = await S3PersistorManager.promises.getFileSize(bucket, key)
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
          await S3PersistorManager.promises.getFileSize(bucket, key)
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
          await S3PersistorManager.promises.getFileSize(bucket, key)
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
        return S3PersistorManager.promises.sendStream(bucket, key, ReadStream)
      })

      it('should upload the stream', function() {
        expect(S3Client.upload).to.have.been.calledWith({
          Bucket: bucket,
          Key: key,
          Body: 'readStream'
        })
      })

      it('should meter the stream', function() {
        expect(ReadStream.pipe).to.have.been.calledWith(MeteredStream)
      })

      it('should record an egress metric', function() {
        expect(Metrics.count).to.have.been.calledWith('s3.egress', objectSize)
      })
    })

    describe('when the upload fails', function() {
      let error
      beforeEach(async function() {
        S3Client.upload = sinon.stub().returns({
          promise: sinon.stub().rejects(genericError)
        })
        try {
          await S3PersistorManager.promises.sendStream(bucket, key, ReadStream)
        } catch (err) {
          error = err
        }
      })

      it('throws a WriteError', function() {
        expect(error).to.be.an.instanceOf(Errors.WriteError)
      })
    })
  })

  describe('sendFile', function() {
    describe('with valid parameters', function() {
      beforeEach(async function() {
        return S3PersistorManager.promises.sendFile(bucket, key, filename)
      })

      it('should create a read stream for the file', function() {
        expect(Fs.createReadStream).to.have.been.calledWith(filename)
      })

      it('should upload the stream', function() {
        expect(S3Client.upload).to.have.been.calledWith({
          Bucket: bucket,
          Key: key,
          Body: 'readStream'
        })
      })
    })

    describe('when the file does not exist', function() {
      let error

      beforeEach(async function() {
        Fs.createReadStream = sinon.stub().throws(FileNotFoundError)
        try {
          await S3PersistorManager.promises.sendFile(bucket, key, filename)
        } catch (err) {
          error = err
        }
      })

      it('returns a NotFoundError', function() {
        expect(error).to.be.an.instanceOf(Errors.NotFoundError)
      })

      it('wraps the error', function() {
        expect(error.cause).to.equal(FileNotFoundError)
      })
    })

    describe('when reading the file throws an error', function() {
      let error

      beforeEach(async function() {
        Fs.createReadStream = sinon.stub().throws(genericError)
        try {
          await S3PersistorManager.promises.sendFile(bucket, key, filename)
        } catch (err) {
          error = err
        }
      })

      it('returns a ReadError', function() {
        expect(error).to.be.an.instanceOf(Errors.ReadError)
      })

      it('wraps the error', function() {
        expect(error.cause).to.equal(genericError)
      })
    })
  })

  describe('copyFile', function() {
    describe('with valid parameters', function() {
      beforeEach(async function() {
        return S3PersistorManager.promises.copyFile(bucket, key, destKey)
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
          await S3PersistorManager.promises.copyFile(bucket, key, destKey)
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
        return S3PersistorManager.promises.deleteFile(bucket, key)
      })

      it('should delete the object', function() {
        expect(S3Client.deleteObject).to.have.been.calledWith({
          Bucket: bucket,
          Key: key
        })
      })
    })

    describe('when the file does not exist', function() {
      let error

      beforeEach(async function() {
        S3Client.deleteObject = sinon.stub().returns({
          promise: sinon.stub().rejects(S3NotFoundError)
        })
        try {
          await S3PersistorManager.promises.deleteFile(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should throw a NotFoundError', function() {
        expect(error).to.be.an.instanceOf(Errors.NotFoundError)
      })
    })
  })

  describe('deleteDirectory', function() {
    describe('with valid parameters', function() {
      beforeEach(async function() {
        return S3PersistorManager.promises.deleteDirectory(bucket, key)
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
        return S3PersistorManager.promises.deleteDirectory(bucket, key)
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
          await S3PersistorManager.promises.deleteDirectory(bucket, key)
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
          await S3PersistorManager.promises.deleteDirectory(bucket, key)
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
        size = await S3PersistorManager.promises.getDirectorySize(bucket, key)
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
        size = await S3PersistorManager.promises.getDirectorySize(bucket, key)
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
          await S3PersistorManager.promises.getDirectorySize(bucket, key)
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
        exists = await S3PersistorManager.promises.checkIfFileExists(
          bucket,
          key
        )
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
        exists = await S3PersistorManager.promises.checkIfFileExists(
          bucket,
          key
        )
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
          await S3PersistorManager.promises.checkIfFileExists(bucket, key)
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
