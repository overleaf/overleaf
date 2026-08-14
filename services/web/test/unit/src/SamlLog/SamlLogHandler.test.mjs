import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import { setReqValidationModeForTests } from '@overleaf/validation-tools'

const modulePath = '../../../../app/src/Features/SamlLog/SamlLogHandler.mjs'

describe('SamlLogHandler', function () {
  let SamlLog, SamlLogHandler

  let data, providerId, samlLog, sessionId

  beforeEach(async function (ctx) {
    samlLog = {
      save: sinon.stub(),
    }
    SamlLog = function () {
      return samlLog
    }

    ctx.logger = {
      error: sinon.stub(),
    }
    vi.doMock('@overleaf/logger', () => ({
      default: ctx.logger,
    }))

    vi.doMock('../../../../app/src/models/SamlLog', () => ({ SamlLog }))

    SamlLogHandler = (await import(modulePath)).default

    data = { foo: true }
    providerId = 'provider-id'
    sessionId = 'session-id'
  })

  describe('with valid data object', function () {
    beforeEach(async function () {
      await SamlLogHandler.promises.log(
        {
          session: { saml: { providerId } },
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
          samlSession: { providerId: 'provider-id' },
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
          session: { saml: { providerId } },
          sessionID: sessionId,
          path: '/saml/ukamf',
        },
        circularRef
      )
    })

    it('should log without data and log error', function (ctx) {
      samlLog.providerId.should.equal(providerId)
      samlLog.sessionId.should.equal(sessionId.substr(0, 8))
      expect(samlLog.data).to.be.undefined
      expect(samlLog.jsonData).to.be.undefined
      samlLog.save.should.have.been.calledOnce
      ctx.logger.error.should.have.been.calledOnce.and.calledWithMatch(
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

    it('should log error', function (ctx) {
      ctx.logger.error.should.have.been.calledOnce.and.calledWithMatch(
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

    it('should log error', function (ctx) {
      ctx.logger.error.should.have.been.calledOnce.and.calledWithMatch(
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

    it('should not log any error', function (ctx) {
      ctx.logger.error.should.not.have.been.called
    })
  })

  describe('with an error and a saml request body', function () {
    function makeReq(body) {
      return {
        session: { saml: { providerId } },
        sessionID: sessionId,
        path: '/saml/ukamf',
        logger: { addFields: sinon.stub() },
        body,
      }
    }

    afterEach(function () {
      setReqValidationModeForTests(null)
    })

    it('should log the email and SAMLResponse fields', async function () {
      await SamlLogHandler.promises.log(
        makeReq({
          email: 'user@example.com',
          SAMLResponse: 'encoded-response',
        }),
        { error: new Error('boom') }
      )

      const loggedData = JSON.parse(samlLog.jsonData)
      expect(loggedData.body).to.deep.equal({
        email: 'user@example.com',
        SAMLResponse: 'encoded-response',
      })
      samlLog.save.should.have.been.calledOnce
    })

    it('should still log by default when the body fails schema validation', async function (ctx) {
      setReqValidationModeForTests('log')
      await SamlLogHandler.promises.log(
        makeReq({ email: { nested: 'not-a-string' } }),
        { error: new Error('boom') }
      )

      const loggedData = JSON.parse(samlLog.jsonData)
      expect(loggedData.body).to.deep.equal({
        email: { nested: 'not-a-string' },
      })
      samlLog.save.should.have.been.calledOnce
      ctx.logger.error.should.not.have.been.called
    })

    it('should not save and should log an error when REQ_VALIDATION_MODE=enforce', async function (ctx) {
      setReqValidationModeForTests('enforce')

      await SamlLogHandler.promises.log(
        makeReq({ email: { nested: 'not-a-string' } }),
        { error: new Error('boom') }
      )

      samlLog.save.should.not.have.been.called
      ctx.logger.error.should.have.been.calledOnce.and.calledWithMatch(
        { providerId, sessionId: sessionId.substr(0, 8) },
        'SamlLog Error'
      )
    })
  })
})
