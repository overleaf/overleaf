const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const modulePath = '../../../app/js/MigrationPersistor.js'
const SandboxedModule = require('sandboxed-module')

const Errors = require('../../../app/js/Errors')

// Not all methods are tested here, but a method with each type of wrapping has
// tests. Specifically, the following wrapping methods are tested here:
// getFileStream: _wrapFallbackMethod
// sendStream: forward-to-primary
// deleteFile: _wrapMethodOnBothPersistors
// copyFile: copyFileWithFallback

describe('MigrationPersistorTests', function() {
  const bucket = 'womBucket'
  const fallbackBucket = 'bucKangaroo'
  const key = 'monKey'
  const destKey = 'donKey'
  const genericError = new Error('guru meditation error')
  const notFoundError = new Errors.NotFoundError('not found')
  const size = 33
  const md5 = 'ffffffff'

  let Metrics,
    Settings,
    Logger,
    MigrationPersistor,
    Minipass,
    fileStream,
    newPersistor

  beforeEach(function() {
    fileStream = {
      name: 'fileStream',
      on: sinon
        .stub()
        .withArgs('end')
        .yields(),
      pipe: sinon.stub()
    }

    newPersistor = function(hasFile) {
      return {
        promises: {
          sendFile: sinon.stub().resolves(),
          sendStream: sinon.stub().resolves(),
          getFileStream: hasFile
            ? sinon.stub().resolves(fileStream)
            : sinon.stub().rejects(notFoundError),
          deleteDirectory: sinon.stub().resolves(),
          getFileSize: hasFile
            ? sinon.stub().resolves(size)
            : sinon.stub().rejects(notFoundError),
          deleteFile: sinon.stub().resolves(),
          copyFile: hasFile
            ? sinon.stub().resolves()
            : sinon.stub().rejects(notFoundError),
          checkIfFileExists: sinon.stub().resolves(hasFile),
          directorySize: hasFile
            ? sinon.stub().resolves(size)
            : sinon.stub().rejects(notFoundError),
          getFileMd5Hash: hasFile
            ? sinon.stub().resolves(md5)
            : sinon.stub().rejects(notFoundError)
        }
      }
    }

    Settings = {
      filestore: {
        fallback: {
          buckets: {
            [bucket]: fallbackBucket
          }
        }
      }
    }

    Metrics = {
      inc: sinon.stub()
    }

    Logger = {
      warn: sinon.stub()
    }

    Minipass = sinon.stub()
    Minipass.prototype.on = sinon
      .stub()
      .withArgs('end')
      .yields()
    Minipass.prototype.pipe = sinon.stub()

    MigrationPersistor = SandboxedModule.require(modulePath, {
      requires: {
        'settings-sharelatex': Settings,
        './Errors': Errors,
        'metrics-sharelatex': Metrics,
        'logger-sharelatex': Logger,
        minipass: Minipass
      },
      globals: { console }
    })
  })

  describe('getFileStream', function() {
    const options = { wombat: 'potato' }
    describe('when the primary persistor has the file', function() {
      let primaryPersistor, fallbackPersistor, migrationPersistor, response
      beforeEach(async function() {
        primaryPersistor = newPersistor(true)
        fallbackPersistor = newPersistor(false)
        migrationPersistor = MigrationPersistor(
          primaryPersistor,
          fallbackPersistor
        )
        response = await migrationPersistor.promises.getFileStream(
          bucket,
          key,
          options
        )
      })

      it('should return the file stream', function() {
        expect(response).to.equal(fileStream)
      })

      it('should fetch the file from the primary persistor, with the correct options', function() {
        expect(
          primaryPersistor.promises.getFileStream
        ).to.have.been.calledWithExactly(bucket, key, options)
      })

      it('should not query the fallback persistor', function() {
        expect(fallbackPersistor.promises.getFileStream).not.to.have.been.called
      })
    })

    describe('when the fallback persistor has the file', function() {
      let primaryPersistor, fallbackPersistor, migrationPersistor, response
      beforeEach(async function() {
        primaryPersistor = newPersistor(false)
        fallbackPersistor = newPersistor(true)
        migrationPersistor = MigrationPersistor(
          primaryPersistor,
          fallbackPersistor
        )
        response = await migrationPersistor.promises.getFileStream(
          bucket,
          key,
          options
        )
      })

      it('should return the file stream', function() {
        expect(response).to.equal(fileStream)
      })

      it('should fetch the file from the primary persistor with the correct options', function() {
        expect(
          primaryPersistor.promises.getFileStream
        ).to.have.been.calledWithExactly(bucket, key, options)
      })

      it('should fetch the file from the fallback persistor with the fallback bucket with the correct options', function() {
        expect(
          fallbackPersistor.promises.getFileStream
        ).to.have.been.calledWithExactly(fallbackBucket, key, options)
      })

      it('should create one read stream', function() {
        expect(fallbackPersistor.promises.getFileStream).to.have.been.calledOnce
      })

      it('should not send the file to the primary', function() {
        expect(primaryPersistor.promises.sendStream).not.to.have.been.called
      })
    })

    describe('when the file should be copied to the primary', function() {
      let primaryPersistor,
        fallbackPersistor,
        migrationPersistor,
        returnedStream
      beforeEach(async function() {
        primaryPersistor = newPersistor(false)
        fallbackPersistor = newPersistor(true)
        migrationPersistor = MigrationPersistor(
          primaryPersistor,
          fallbackPersistor
        )
        Settings.filestore.fallback.copyOnMiss = true
        returnedStream = await migrationPersistor.promises.getFileStream(
          bucket,
          key,
          options
        )
      })

      it('should create one read stream', function() {
        expect(fallbackPersistor.promises.getFileStream).to.have.been.calledOnce
      })

      it('should get the md5 hash from the source', function() {
        expect(
          fallbackPersistor.promises.getFileMd5Hash
        ).to.have.been.calledWith(fallbackBucket, key)
      })

      it('should send a stream to the primary', function() {
        expect(
          primaryPersistor.promises.sendStream
        ).to.have.been.calledWithExactly(
          bucket,
          key,
          sinon.match.instanceOf(Minipass),
          md5
        )
      })

      it('should send a stream to the client', function() {
        expect(returnedStream).to.be.an.instanceOf(Minipass)
      })
    })

    describe('when neither persistor has the file', function() {
      it('rejects with a NotFoundError', async function() {
        const migrationPersistor = MigrationPersistor(
          newPersistor(false),
          newPersistor(false)
        )
        return expect(
          migrationPersistor.promises.getFileStream(bucket, key)
        ).to.eventually.be.rejected.and.be.an.instanceOf(Errors.NotFoundError)
      })
    })

    describe('when the primary persistor throws an unexpected error', function() {
      let primaryPersistor, fallbackPersistor, migrationPersistor, error
      beforeEach(async function() {
        primaryPersistor = newPersistor(false)
        fallbackPersistor = newPersistor(true)
        primaryPersistor.promises.getFileStream = sinon
          .stub()
          .rejects(genericError)
        migrationPersistor = MigrationPersistor(
          primaryPersistor,
          fallbackPersistor
        )
        try {
          await migrationPersistor.promises.getFileStream(bucket, key, options)
        } catch (err) {
          error = err
        }
      })

      it('rejects with the error', function() {
        expect(error).to.equal(genericError)
      })

      it('does not call the fallback', function() {
        expect(fallbackPersistor.promises.getFileStream).not.to.have.been.called
      })
    })

    describe('when the fallback persistor throws an unexpected error', function() {
      let primaryPersistor, fallbackPersistor, migrationPersistor, error
      beforeEach(async function() {
        primaryPersistor = newPersistor(false)
        fallbackPersistor = newPersistor(false)
        fallbackPersistor.promises.getFileStream = sinon
          .stub()
          .rejects(genericError)
        migrationPersistor = MigrationPersistor(
          primaryPersistor,
          fallbackPersistor
        )
        try {
          await migrationPersistor.promises.getFileStream(bucket, key, options)
        } catch (err) {
          error = err
        }
      })

      it('rejects with the error', function() {
        expect(error).to.equal(genericError)
      })

      it('should have called the fallback', function() {
        expect(
          fallbackPersistor.promises.getFileStream
        ).to.have.been.calledWith(fallbackBucket, key)
      })
    })
  })

  describe('sendStream', function() {
    let primaryPersistor, fallbackPersistor, migrationPersistor
    beforeEach(function() {
      primaryPersistor = newPersistor(false)
      fallbackPersistor = newPersistor(false)
      migrationPersistor = MigrationPersistor(
        primaryPersistor,
        fallbackPersistor
      )
    })

    describe('when it works', function() {
      beforeEach(async function() {
        return migrationPersistor.promises.sendStream(bucket, key, fileStream)
      })

      it('should send the file to the primary persistor', function() {
        expect(
          primaryPersistor.promises.sendStream
        ).to.have.been.calledWithExactly(bucket, key, fileStream)
      })

      it('should not send the file to the fallback persistor', function() {
        expect(fallbackPersistor.promises.sendStream).not.to.have.been.called
      })
    })

    describe('when the primary persistor throws an error', function() {
      it('returns the error', async function() {
        primaryPersistor.promises.sendStream.rejects(notFoundError)
        return expect(
          migrationPersistor.promises.sendStream(bucket, key, fileStream)
        ).to.eventually.be.rejected.and.be.an.instanceOf(Errors.NotFoundError)
      })
    })
  })

  describe('deleteFile', function() {
    let primaryPersistor, fallbackPersistor, migrationPersistor
    beforeEach(function() {
      primaryPersistor = newPersistor(false)
      fallbackPersistor = newPersistor(false)
      migrationPersistor = MigrationPersistor(
        primaryPersistor,
        fallbackPersistor
      )
    })

    describe('when it works', function() {
      beforeEach(async function() {
        return migrationPersistor.promises.deleteFile(bucket, key)
      })

      it('should delete the file from the primary', function() {
        expect(
          primaryPersistor.promises.deleteFile
        ).to.have.been.calledWithExactly(bucket, key)
      })

      it('should delete the file from the fallback', function() {
        expect(
          fallbackPersistor.promises.deleteFile
        ).to.have.been.calledWithExactly(fallbackBucket, key)
      })
    })

    describe('when the primary persistor throws an error', function() {
      let error
      beforeEach(async function() {
        primaryPersistor.promises.deleteFile.rejects(genericError)
        try {
          await migrationPersistor.promises.deleteFile(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should return the error', function() {
        expect(error).to.equal(genericError)
      })

      it('should delete the file from the primary', function() {
        expect(
          primaryPersistor.promises.deleteFile
        ).to.have.been.calledWithExactly(bucket, key)
      })

      it('should delete the file from the fallback', function() {
        expect(
          fallbackPersistor.promises.deleteFile
        ).to.have.been.calledWithExactly(fallbackBucket, key)
      })
    })

    describe('when the fallback persistor throws an error', function() {
      let error
      beforeEach(async function() {
        fallbackPersistor.promises.deleteFile.rejects(genericError)
        try {
          await migrationPersistor.promises.deleteFile(bucket, key)
        } catch (err) {
          error = err
        }
      })

      it('should return the error', function() {
        expect(error).to.equal(genericError)
      })

      it('should delete the file from the primary', function() {
        expect(
          primaryPersistor.promises.deleteFile
        ).to.have.been.calledWithExactly(bucket, key)
      })

      it('should delete the file from the fallback', function() {
        expect(
          fallbackPersistor.promises.deleteFile
        ).to.have.been.calledWithExactly(fallbackBucket, key)
      })
    })
  })

  describe('copyFile', function() {
    describe('when the file exists on the primary', function() {
      let primaryPersistor, fallbackPersistor, migrationPersistor
      beforeEach(async function() {
        primaryPersistor = newPersistor(true)
        fallbackPersistor = newPersistor(false)
        migrationPersistor = MigrationPersistor(
          primaryPersistor,
          fallbackPersistor
        )
        return migrationPersistor.promises.copyFile(bucket, key, destKey)
      })

      it('should call copyFile to copy the file', function() {
        expect(
          primaryPersistor.promises.copyFile
        ).to.have.been.calledWithExactly(bucket, key, destKey)
      })

      it('should not try to read from the fallback', function() {
        expect(fallbackPersistor.promises.getFileStream).not.to.have.been.called
      })
    })

    describe('when the file does not exist on the primary', function() {
      let primaryPersistor, fallbackPersistor, migrationPersistor
      beforeEach(async function() {
        primaryPersistor = newPersistor(false)
        fallbackPersistor = newPersistor(true)
        migrationPersistor = MigrationPersistor(
          primaryPersistor,
          fallbackPersistor
        )
        return migrationPersistor.promises.copyFile(bucket, key, destKey)
      })

      it('should call copyFile to copy the file', function() {
        expect(
          primaryPersistor.promises.copyFile
        ).to.have.been.calledWithExactly(bucket, key, destKey)
      })

      it('should fetch the file from the fallback', function() {
        expect(
          fallbackPersistor.promises.getFileStream
        ).not.to.have.been.calledWithExactly(fallbackBucket, key)
      })

      it('should get the md5 hash from the source', function() {
        expect(
          fallbackPersistor.promises.getFileMd5Hash
        ).to.have.been.calledWith(fallbackBucket, key)
      })

      it('should send the file to the primary', function() {
        expect(
          primaryPersistor.promises.sendStream
        ).to.have.been.calledWithExactly(bucket, destKey, fileStream, md5)
      })
    })

    describe('when the file does not exist on the fallback', function() {
      let primaryPersistor, fallbackPersistor, migrationPersistor, error
      beforeEach(async function() {
        primaryPersistor = newPersistor(false)
        fallbackPersistor = newPersistor(false)
        migrationPersistor = MigrationPersistor(
          primaryPersistor,
          fallbackPersistor
        )
        try {
          await migrationPersistor.promises.copyFile(bucket, key, destKey)
        } catch (err) {
          error = err
        }
      })

      it('should call copyFile to copy the file', function() {
        expect(
          primaryPersistor.promises.copyFile
        ).to.have.been.calledWithExactly(bucket, key, destKey)
      })

      it('should fetch the file from the fallback', function() {
        expect(
          fallbackPersistor.promises.getFileStream
        ).not.to.have.been.calledWithExactly(fallbackBucket, key)
      })

      it('should return a not-found error', function() {
        expect(error).to.be.an.instanceOf(Errors.NotFoundError)
      })
    })
  })
})
