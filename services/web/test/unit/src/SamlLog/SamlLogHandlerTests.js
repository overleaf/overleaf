const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')

const modulePath = '../../../../app/src/Features/SamlLog/SamlLogHandler'

describe('SamlLogHandler', function () {
  let SamlLog, SamlLogHandler, SamlLogModel

  let data, providerId, samlLog, sessionId

  beforeEach(function () {
    samlLog = {
      save: sinon.stub(),
    }
    SamlLog = function () {
      return samlLog
    }
    SamlLogModel = { SamlLog }
    SamlLogHandler = SandboxedModule.require(modulePath, {
      requires: {
        '../../models/SamlLog': SamlLogModel,
      },
    })

    data = { foo: true }
    providerId = 'provider-id'
    sessionId = 'session-id'
  })

  describe('with valid data object', function () {
    beforeEach(async function () {
      await SamlLogHandler.promises.log(
        {
          session: { saml: { universityId: providerId } },
          sessionID: sessionId,
          path: '/saml/ukamf',
        },
        data
      )
    })

    it('should log data', function () {
      samlLog.providerId.should.equal(providerId)
      samlLog.sessionId.should.equal(sessionId.substr(0, 8))
      samlLog.jsonData.should.equal(
        JSON.stringify({
          foo: true,
          samlSession: { universityId: 'provider-id' },
        })
      )
      expect(samlLog.data).to.be.undefined
      samlLog.save.should.have.been.calledOnce
    })
  })

  describe('when a json stringify error occurs', function () {
    beforeEach(async function () {
      const circularRef = {}
      circularRef.circularRef = circularRef

      await SamlLogHandler.promises.log(
        {
          session: { saml: { universityId: providerId } },
          sessionID: sessionId,
          path: '/saml/ukamf',
        },
        circularRef
      )
    })

    it('should log without data and log error', function () {
      samlLog.providerId.should.equal(providerId)
      samlLog.sessionId.should.equal(sessionId.substr(0, 8))
      expect(samlLog.data).to.be.undefined
      expect(samlLog.jsonData).to.be.undefined
      samlLog.save.should.have.been.calledOnce
      this.logger.error.should.have.been.calledOnce.and.calledWithMatch(
        { providerId, sessionId: sessionId.substr(0, 8) },
        'SamlLog JSON.stringify Error'
      )
    })
  })

  describe('when logging error occurs', function () {
    let err

    beforeEach(async function () {
      err = new Error()
      samlLog.save = sinon.stub().rejects(err)

      await SamlLogHandler.promises.log(
        {
          session: { saml: { universityId: providerId } },
          sessionID: sessionId,
          path: '/saml/ukamf',
        },
        data
      )
    })

    it('should log error', function () {
      this.logger.error.should.have.been.calledOnce.and.calledWithMatch(
        {
          err,
          sessionId: sessionId.substr(0, 8),
        },
        'SamlLog Error'
      )
    })
  })

  describe('with /saml/group-sso path', function () {
    let err

    beforeEach(async function () {
      err = new Error()
      samlLog.save = sinon.stub().rejects(err)

      await SamlLogHandler.promises.log(
        {
          session: { saml: { universityId: providerId } },
          sessionID: sessionId,
          path: '/saml/group-sso',
        },
        data
      )
    })

    it('should log error', function () {
      this.logger.error.should.have.been.calledOnce.and.calledWithMatch(
        {
          err,
          sessionId: sessionId.substr(0, 8),
        },
        'SamlLog Error'
      )
    })
  })

  describe('with a path not in the allow list', function () {
    let err

    beforeEach(async function () {
      err = new Error()
      samlLog.save = sinon.stub().rejects(err)

      await SamlLogHandler.promises.log(
        {
          session: { saml: { universityId: providerId } },
          sessionID: sessionId,
          path: '/unsupported',
        },
        data
      )
    })

    it('should not log any error', function () {
      this.logger.error.should.not.have.been.called
    })
  })
})
