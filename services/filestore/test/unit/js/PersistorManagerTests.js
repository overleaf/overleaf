const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const SandboxedModule = require('sandboxed-module')

const modulePath = '../../../app/js/PersistorManager.js'

describe('PersistorManager', function() {
  let PersistorManager,
    FSPersistorManager,
    S3PersistorManager,
    settings,
    requires

  beforeEach(function() {
    FSPersistorManager = {
      wrappedMethod: sinon.stub().returns('FSPersistorManager')
    }
    S3PersistorManager = {
      wrappedMethod: sinon.stub().returns('S3PersistorManager')
    }

    settings = {
      filestore: {}
    }

    requires = {
      './S3PersistorManager': S3PersistorManager,
      './FSPersistorManager': FSPersistorManager,
      'settings-sharelatex': settings,
      'logger-sharelatex': {
        log() {},
        err() {}
      }
    }
  })

  it('should implement the S3 wrapped method when S3 is configured', function() {
    settings.filestore.backend = 's3'
    PersistorManager = SandboxedModule.require(modulePath, { requires })

    expect(PersistorManager).to.respondTo('wrappedMethod')
    expect(PersistorManager.wrappedMethod()).to.equal('S3PersistorManager')
  })

  it("should implement the S3 wrapped method when 'aws-sdk' is configured", function() {
    settings.filestore.backend = 'aws-sdk'
    PersistorManager = SandboxedModule.require(modulePath, { requires })

    expect(PersistorManager).to.respondTo('wrappedMethod')
    expect(PersistorManager.wrappedMethod()).to.equal('S3PersistorManager')
  })

  it('should implement the FS wrapped method when FS is configured', function() {
    settings.filestore.backend = 'fs'
    PersistorManager = SandboxedModule.require(modulePath, { requires })

    expect(PersistorManager).to.respondTo('wrappedMethod')
    expect(PersistorManager.wrappedMethod()).to.equal('FSPersistorManager')
  })

  it('should throw an error when the backend is not configured', function() {
    try {
      SandboxedModule.require(modulePath, { requires })
    } catch (err) {
      expect(err.message).to.equal('no backend specified - config incomplete')
      return
    }
    expect('should have caught an error').not.to.exist
  })

  it('should throw an error when the backend is unknown', function() {
    settings.filestore.backend = 'magic'
    try {
      SandboxedModule.require(modulePath, { requires })
    } catch (err) {
      expect(err.message).to.equal('unknown filestore backend: magic')
      return
    }
    expect('should have caught an error').not.to.exist
  })
})
