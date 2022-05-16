const chai = require('chai')
const { expect } = chai
const SandboxedModule = require('sandboxed-module')

const modulePath = '../../src/PersistorFactory.js'

describe('PersistorManager', function () {
  let PersistorFactory, FSPersistor, S3Persistor, Settings, GcsPersistor

  beforeEach(function () {
    FSPersistor = class {
      wrappedMethod() {
        return 'FSPersistor'
      }
    }
    S3Persistor = class {
      wrappedMethod() {
        return 'S3Persistor'
      }
    }
    GcsPersistor = class {
      wrappedMethod() {
        return 'GcsPersistor'
      }
    }

    Settings = {}
    const requires = {
      './GcsPersistor': GcsPersistor,
      './S3Persistor': S3Persistor,
      './FSPersistor': FSPersistor,
      '@overleaf/logger': {
        info() {},
        err() {},
      },
    }
    PersistorFactory = SandboxedModule.require(modulePath, { requires })
  })

  it('should implement the S3 wrapped method when S3 is configured', function () {
    Settings.backend = 's3'

    expect(PersistorFactory(Settings)).to.respondTo('wrappedMethod')
    expect(PersistorFactory(Settings).wrappedMethod()).to.equal('S3Persistor')
  })

  it("should implement the S3 wrapped method when 'aws-sdk' is configured", function () {
    Settings.backend = 'aws-sdk'

    expect(PersistorFactory(Settings)).to.respondTo('wrappedMethod')
    expect(PersistorFactory(Settings).wrappedMethod()).to.equal('S3Persistor')
  })

  it('should implement the FS wrapped method when FS is configured', function () {
    Settings.backend = 'fs'

    expect(PersistorFactory(Settings)).to.respondTo('wrappedMethod')
    expect(PersistorFactory(Settings).wrappedMethod()).to.equal('FSPersistor')
  })

  it('should throw an error when the backend is not configured', function () {
    try {
      PersistorFactory(Settings)
    } catch (err) {
      expect(err.message).to.equal('no backend specified - config incomplete')
      return
    }
    expect('should have caught an error').not.to.exist
  })

  it('should throw an error when the backend is unknown', function () {
    Settings.backend = 'magic'
    try {
      PersistorFactory(Settings)
    } catch (err) {
      expect(err.message).to.equal('unknown backend')
      expect(err.info.backend).to.equal('magic')
      return
    }
    expect('should have caught an error').not.to.exist
  })
})
