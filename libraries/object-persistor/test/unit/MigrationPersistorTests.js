const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const modulePath = '../../src/MigrationPersistor.js'
const SandboxedModule = require('sandboxed-module')

const Errors = require('../../src/Errors')

// Not all methods are tested here, but a method with each type of wrapping has
// tests. Specifically, the following wrapping methods are tested here:
// getObjectStream: _wrapFallbackMethod
// sendStream: forward-to-primary
// deleteObject: _wrapMethodOnBothPersistors
// copyObject: copyFileWithFallback

describe('MigrationPersistorTests', function () {
  const bucket = 'womBucket'
  const fallbackBucket = 'bucKangaroo'
  const key = 'monKey'
  const destKey = 'donKey'
  const genericError = new Error('guru meditation error')
  const notFoundError = new Errors.NotFoundError('not found')
  const size = 33
  const md5 = 'ffffffff'

  let Settings,
    Logger,
    Stream,
    StreamPromises,
    MigrationPersistor,
    fileStream,
    newPersistor

  beforeEach(function () {
    fileStream = {
      name: 'fileStream',
      on: sinon.stub().withArgs('end').yields(),
      pipe: sinon.stub(),
    }

    newPersistor = function (hasFile) {
      return {
        sendFile: sinon.stub().resolves(),
        sendStream: sinon.stub().resolves(),
        getObjectStream: hasFile
          ? sinon.stub().resolves(fileStream)
          : sinon.stub().rejects(notFoundError),
        deleteDirectory: sinon.stub().resolves(),
        getObjectSize: hasFile
          ? sinon.stub().resolves(size)
          : sinon.stub().rejects(notFoundError),
        deleteObject: sinon.stub().resolves(),
        copyObject: hasFile
          ? sinon.stub().resolves()
          : sinon.stub().rejects(notFoundError),
        checkIfObjectExists: sinon.stub().resolves(hasFile),
        directorySize: hasFile
          ? sinon.stub().resolves(size)
          : sinon.stub().rejects(notFoundError),
        getObjectMd5Hash: hasFile
          ? sinon.stub().resolves(md5)
          : sinon.stub().rejects(notFoundError),
      }
    }

    Settings = {
      buckets: {
        [bucket]: fallbackBucket,
      },
    }

    Stream = {
      PassThrough: sinon.stub(),
    }

    StreamPromises = {
      pipeline: sinon.stub().resolves(),
    }

    Logger = {
      warn: sinon.stub(),
    }

    MigrationPersistor = SandboxedModule.require(modulePath, {
      requires: {
        stream: Stream,
        'stream/promises': StreamPromises,
        './Errors': Errors,
        '@overleaf/logger': Logger,
      },
      globals: { console },
    })
  })

  describe('getObjectStream', function () {
    const options = { wombat: 'potato' }
    describe('when the primary persistor has the file', function () {
      let primaryPersistor, fallbackPersistor, migrationPersistor, response
      beforeEach(async function () {
        primaryPersistor = newPersistor(true)
        fallbackPersistor = newPersistor(false)
        migrationPersistor = new MigrationPersistor(
          primaryPersistor,
          fallbackPersistor,
          Settings
        )
        response = await migrationPersistor.getObjectStream(
          bucket,
          key,
          options
        )
      })

      it('should return the file stream', function () {
        expect(response).to.equal(fileStream)
      })

      it('should fetch the file from the primary persistor, with the correct options', function () {
        expect(primaryPersistor.getObjectStream).to.have.been.calledWithExactly(
          bucket,
          key,
          options
        )
      })

      it('should not query the fallback persistor', function () {
        expect(fallbackPersistor.getObjectStream).not.to.have.been.called
      })
    })

    describe('when the fallback persistor has the file', function () {
      let primaryPersistor, fallbackPersistor, migrationPersistor, response
      beforeEach(async function () {
        primaryPersistor = newPersistor(false)
        fallbackPersistor = newPersistor(true)
        migrationPersistor = new MigrationPersistor(
          primaryPersistor,
          fallbackPersistor,
          Settings
        )
        response = await migrationPersistor.getObjectStream(
          bucket,
          key,
          options
        )
      })

      it('should return the file stream', function () {
        expect(response).to.be.an.instanceOf(Stream.PassThrough)
      })

      it('should fetch the file from the primary persistor with the correct options', function () {
        expect(primaryPersistor.getObjectStream).to.have.been.calledWithExactly(
          bucket,
          key,
          options
        )
      })

      it('should fetch the file from the fallback persistor with the fallback bucket with the correct options', function () {
        expect(
          fallbackPersistor.getObjectStream
        ).to.have.been.calledWithExactly(fallbackBucket, key, options)
      })

      it('should create one read stream', function () {
        expect(fallbackPersistor.getObjectStream).to.have.been.calledOnce
      })

      it('should not send the file to the primary', function () {
        expect(primaryPersistor.sendStream).not.to.have.been.called
      })
    })

    describe('when the file should be copied to the primary', function () {
      let primaryPersistor,
        fallbackPersistor,
        migrationPersistor,
        returnedStream
      beforeEach(async function () {
        primaryPersistor = newPersistor(false)
        fallbackPersistor = newPersistor(true)
        migrationPersistor = new MigrationPersistor(
          primaryPersistor,
          fallbackPersistor,
          Settings
        )
        Settings.copyOnMiss = true
        returnedStream = await migrationPersistor.getObjectStream(
          bucket,
          key,
          options
        )
      })

      it('should create one read stream', function () {
        expect(fallbackPersistor.getObjectStream).to.have.been.calledOnce
      })

      it('should send a stream to the primary', function () {
        expect(primaryPersistor.sendStream).to.have.been.calledWithExactly(
          bucket,
          key,
          sinon.match.instanceOf(Stream.PassThrough)
        )
      })

      it('should send a stream to the client', function () {
        expect(returnedStream).to.be.an.instanceOf(Stream.PassThrough)
      })
    })

    describe('when neither persistor has the file', function () {
      it('rejects with a NotFoundError', async function () {
        const migrationPersistor = new MigrationPersistor(
          newPersistor(false),
          newPersistor(false),
          Settings
        )
        await expect(
          migrationPersistor.getObjectStream(bucket, key)
        ).to.eventually.be.rejected.and.be.an.instanceOf(Errors.NotFoundError)
      })
    })

    describe('when the primary persistor throws an unexpected error', function () {
      let primaryPersistor, fallbackPersistor, migrationPersistor, error
      beforeEach(async function () {
        primaryPersistor = newPersistor(false)
        fallbackPersistor = newPersistor(true)
        primaryPersistor.getObjectStream = sinon.stub().rejects(genericError)
        migrationPersistor = new MigrationPersistor(
          primaryPersistor,
          fallbackPersistor,
          Settings
        )
        try {
          await migrationPersistor.getObjectStream(bucket, key, options)
        } catch (err) {
          error = err
        }
      })

      it('rejects with the error', function () {
        expect(error).to.equal(genericError)
      })

      it('does not call the fallback', function () {
        expect(fallbackPersistor.getObjectStream).not.to.have.been.called
      })
    })

    describe('when the fallback persistor throws an unexpected error', function () {
      let primaryPersistor, fallbackPersistor, migrationPersistor, error
      beforeEach(async function () {
        primaryPersistor = newPersistor(false)
        fallbackPersistor = newPersistor(false)
        fallbackPersistor.getObjectStream = sinon.stub().rejects(genericError)
        migrationPersistor = new MigrationPersistor(
          primaryPersistor,
          fallbackPersistor,
          Settings
        )
        try {
          await migrationPersistor.getObjectStream(bucket, key, options)
        } catch (err) {
          error = err
        }
      })

      it('rejects with the error', function () {
        expect(error).to.equal(genericError)
      })

      it('should have called the fallback', function () {
        expect(fallbackPersistor.getObjectStream).to.have.been.calledWith(
          fallbackBucket,
          key
        )
      })
    })
  })

  describe('sendStream', function () {
    let primaryPersistor, fallbackPersistor, migrationPersistor
    beforeEach(function () {
      primaryPersistor = newPersistor(false)
      fallbackPersistor = newPersistor(false)
      migrationPersistor = new MigrationPersistor(
        primaryPersistor,
        fallbackPersistor,
        Settings
      )
    })

    describe('when it works', function () {
      beforeEach(async function () {
        return migrationPersistor.sendStream(bucket, key, fileStream)
      })

      it('should send the file to the primary persistor', function () {
        expect(primaryPersistor.sendStream).to.have.been.calledWithExactly(
          bucket,
          key,
          fileStream
        )
      })

      it('should not send the file to the fallback persistor', function () {
        expect(fallbackPersistor.sendStream).not.to.have.been.called
      })
    })

    describe('when the primary persistor throws an error', function () {
      it('returns the error', async function () {
        primaryPersistor.sendStream.rejects(notFoundError)
        await expect(
          migrationPersistor.sendStream(bucket, key, fileStream)
        ).to.eventually.be.rejected.and.be.an.instanceOf(Errors.NotFoundError)
      })
    })
  })

  describe('deleteObject', function () {
    let primaryPersistor, fallbackPersistor, migrationPersistor
    beforeEach(function () {
      primaryPersistor = newPersistor(false)
      fallbackPersistor = newPersistor(false)
      migrationPersistor = new MigrationPersistor(
        primaryPersistor,
        fallbackPersistor,
        Settings
      )
    })

    describe('when it works', function () {
      beforeEach(async function () {
        return migrationPersistor.deleteObject(bucket, key)
      })

      it('should delete the file from the primary', function () {
        expect(primaryPersistor.deleteObject).to.have.been.calledWithExactly(
          bucket,
          key
        )
      })

      it('should delete the file from the fallback', function () {
        expect(fallbackPersistor.deleteObject).to.have.been.calledWithExactly(
          fallbackBucket,
          key
        )
      })
    })

    describe('when the primary persistor throws an error', function () {
      let error
      beforeEach(async function () {
        primaryPersistor.deleteObject.rejects(genericError)
        try {
          await migrationPersistor.deleteObject(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should return the error', function () {
        expect(error).to.equal(genericError)
      })

      it('should delete the file from the primary', function () {
        expect(primaryPersistor.deleteObject).to.have.been.calledWithExactly(
          bucket,
          key
        )
      })

      it('should delete the file from the fallback', function () {
        expect(fallbackPersistor.deleteObject).to.have.been.calledWithExactly(
          fallbackBucket,
          key
        )
      })
    })

    describe('when the fallback persistor throws an error', function () {
      let error
      beforeEach(async function () {
        fallbackPersistor.deleteObject.rejects(genericError)
        try {
          await migrationPersistor.deleteObject(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should return the error', function () {
        expect(error).to.equal(genericError)
      })

      it('should delete the file from the primary', function () {
        expect(primaryPersistor.deleteObject).to.have.been.calledWithExactly(
          bucket,
          key
        )
      })

      it('should delete the file from the fallback', function () {
        expect(fallbackPersistor.deleteObject).to.have.been.calledWithExactly(
          fallbackBucket,
          key
        )
      })
    })
  })

  describe('copyObject', function () {
    describe('when the file exists on the primary', function () {
      let primaryPersistor, fallbackPersistor, migrationPersistor
      beforeEach(async function () {
        primaryPersistor = newPersistor(true)
        fallbackPersistor = newPersistor(false)
        migrationPersistor = new MigrationPersistor(
          primaryPersistor,
          fallbackPersistor,
          Settings
        )
        return migrationPersistor.copyObject(bucket, key, destKey)
      })

      it('should call copyObject to copy the file', function () {
        expect(primaryPersistor.copyObject).to.have.been.calledWithExactly(
          bucket,
          key,
          destKey
        )
      })

      it('should not try to read from the fallback', function () {
        expect(fallbackPersistor.getObjectStream).not.to.have.been.called
      })
    })

    describe('when the file does not exist on the primary', function () {
      let primaryPersistor, fallbackPersistor, migrationPersistor
      beforeEach(async function () {
        primaryPersistor = newPersistor(false)
        fallbackPersistor = newPersistor(true)
        migrationPersistor = new MigrationPersistor(
          primaryPersistor,
          fallbackPersistor,
          Settings
        )
        return migrationPersistor.copyObject(bucket, key, destKey)
      })

      it('should call copyObject to copy the file', function () {
        expect(primaryPersistor.copyObject).to.have.been.calledWithExactly(
          bucket,
          key,
          destKey
        )
      })

      it('should fetch the file from the fallback', function () {
        expect(
          fallbackPersistor.getObjectStream
        ).not.to.have.been.calledWithExactly(fallbackBucket, key)
      })

      it('should send the file to the primary', function () {
        expect(primaryPersistor.sendStream).to.have.been.calledWithExactly(
          bucket,
          destKey,
          sinon.match.instanceOf(Stream.PassThrough)
        )
      })
    })

    describe('when the file does not exist on the fallback', function () {
      let primaryPersistor, fallbackPersistor, migrationPersistor, error
      beforeEach(async function () {
        primaryPersistor = newPersistor(false)
        fallbackPersistor = newPersistor(false)
        migrationPersistor = new MigrationPersistor(
          primaryPersistor,
          fallbackPersistor,
          Settings
        )
        try {
          await migrationPersistor.copyObject(bucket, key, destKey)
        } catch (err) {
          error = err
        }
      })

      it('should call copyObject to copy the file', function () {
        expect(primaryPersistor.copyObject).to.have.been.calledWithExactly(
          bucket,
          key,
          destKey
        )
      })

      it('should fetch the file from the fallback', function () {
        expect(
          fallbackPersistor.getObjectStream
        ).not.to.have.been.calledWithExactly(fallbackBucket, key)
      })

      it('should return a not-found error', function () {
        expect(error).to.be.an.instanceOf(Errors.NotFoundError)
      })
    })
  })
})
