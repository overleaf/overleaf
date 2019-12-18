const APP_ROOT = '../../../../app/src'
const SandboxedModule = require('sandboxed-module')
const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

chai.use(sinonChai)
const { expect } = chai

const modulePath = `${APP_ROOT}/Features/SamlLog/SamlLogHandler`

describe('SamlLogHandler', function() {
  let LoggerSharelatex, SamlLog, SamlLogHandler, SamlLogModel

  let data, providerId, samlLog, sessionId

  beforeEach(function() {
    LoggerSharelatex = {
      error: sinon.stub()
    }
    samlLog = {
      save: sinon.stub()
    }
    SamlLog = function() {
      return samlLog
    }
    SamlLogModel = { SamlLog }
    SamlLogHandler = SandboxedModule.require(modulePath, {
      globals: { console },
      requires: {
        '../../models/SamlLog': SamlLogModel,
        'logger-sharelatex': LoggerSharelatex
      }
    })

    data = { foo: true }
    providerId = 'provider-id'
    sessionId = 'session-id'
  })

  describe('with valid data object', function() {
    beforeEach(function() {
      SamlLogHandler.log(providerId, sessionId, data)
    })

    it('should log data', function() {
      samlLog.providerId.should.equal(providerId)
      samlLog.sessionId.should.equal(sessionId.substr(0, 8))
      samlLog.jsonData.should.equal('{"foo":true}')
      expect(samlLog.data).to.be.undefined
      samlLog.save.should.have.been.calledOnce
    })
  })

  describe('when a json stringify error occurs', function() {
    beforeEach(function() {
      const circularRef = {}
      circularRef.circularRef = circularRef

      SamlLogHandler.log(providerId, sessionId, circularRef)
    })

    it('should log without data and log error', function() {
      samlLog.providerId.should.equal(providerId)
      samlLog.sessionId.should.equal(sessionId.substr(0, 8))
      expect(samlLog.data).to.be.undefined
      expect(samlLog.jsonData).to.be.undefined
      samlLog.save.should.have.been.calledOnce
      LoggerSharelatex.error.should.have.been.calledOnce.and.calledWithMatch(
        { providerId, sessionId: sessionId.substr(0, 8) },
        'SamlLog JSON.stringify Error'
      )
    })
  })

  describe('when logging error occurs', function() {
    beforeEach(function() {
      samlLog.save = sinon.stub().yields('error')

      SamlLogHandler.log(providerId, sessionId, data)
    })

    it('should log error', function() {
      LoggerSharelatex.error.should.have.been.calledOnce.and.calledWithMatch(
        { err: 'error', providerId, sessionId: sessionId.substr(0, 8) },
        'SamlLog Error'
      )
    })
  })
})
