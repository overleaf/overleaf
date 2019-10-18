const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const modulePath = '../../../../app/src/infrastructure/SessionStoreManager.js'
const SandboxedModule = require('sandboxed-module')

describe('SessionStoreManager', function() {
  beforeEach(function() {
    this.SessionStoreManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'metrics-sharelatex': (this.Metrics = { inc: sinon.stub() }),
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          warn: sinon.stub(),
          error: sinon.stub(),
          err: sinon.stub()
        })
      }
    })
    this.sessionStore = {
      generate: sinon.spy(req => {
        req.session = {}
      })
    }
  })
  describe('enableValidationToken', function() {
    beforeEach(function() {
      this.originalGenerate = this.sessionStore.generate
      this.SessionStoreManager.enableValidationToken(this.sessionStore)
    })
    it('should set up a wrapper around the generate function', function() {
      expect(this.sessionStore.generate).to.not.equal(this.originalGenerate)
    })
    it('should add a validationToken when the generate function is called', function() {
      this.req = { sessionID: '123456789' }
      this.sessionStore.generate(this.req)
      expect(this.req.session.validationToken).to.equal('v1:6789')
    })
    it('should not allow the token to be overwritten', function() {
      this.req = { sessionID: '123456789' }
      this.sessionStore.generate(this.req)
      this.req.session.validationToken = 'try-to-overwrite-token'
      expect(this.req.session.validationToken).to.equal('v1:6789')
    })
  })
  describe('checkValidationToken', function() {
    this.beforeEach(function() {
      this.SessionStoreManager.enableValidationToken(this.sessionStore)
      this.req = { sessionID: '123456789' }
      this.sessionStore.generate(this.req)
    })
    it('should return true when the session id matches the validation token', function() {
      const result = this.SessionStoreManager.checkValidationToken(this.req)
      expect(result).to.equal(true)
    })
    it('should return false when the session id has changed', function() {
      this.req.sessionID = 'abcdefghijklmnopqrstuvwxyz'
      const result = this.SessionStoreManager.checkValidationToken(this.req)
      expect(result).to.equal(false)
    })
    it('should return true when the session does not have a validation token', function() {
      this.req = { sessionID: '123456789', session: {} }
      const result = this.SessionStoreManager.checkValidationToken(this.req)
      expect(result).to.equal(true)
    })
  })
})
