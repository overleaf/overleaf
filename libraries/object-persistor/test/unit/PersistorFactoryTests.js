const chai = require('chai')
const { expect } = chai
const SandboxedModule = require('sandboxed-module')
const StreamPromises = require('node:stream/promises')

const MODULE_PATH = '../../src/PersistorFactory.js'

describe('PersistorManager', function () {
  let PersistorFactory, FSPersistor, S3Persistor, Settings, GcsPersistor

  beforeEach(function () {
    FSPersistor = class {
      constructor(settings) {
        this.settings = settings
      }

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
      './S3Persistor': { S3Persistor },
      './FSPersistor': FSPersistor,
      '@overleaf/logger': {
        info() {},
        err() {},
      },
      'stream/promises': StreamPromises,
    }
    PersistorFactory = SandboxedModule.require(MODULE_PATH, { requires })
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

  it('should forward useSubdirectories=true to FSPersistor', function () {
    Settings.backend = 'fs'
    Settings.useSubdirectories = true

    expect(PersistorFactory(Settings).settings.useSubdirectories).to.be.true
  })

  it('should forward useSubdirectories=false to FSPersistor', function () {
    Settings.backend = 'fs'
    Settings.useSubdirectories = false

    expect(PersistorFactory(Settings).settings.useSubdirectories).to.be.false
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
