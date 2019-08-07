const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/src/Features/Errors/HttpErrorController.js'
const SandboxedModule = require('sandboxed-module')
const MockResponse = require('../helpers/MockResponse')
const MockRequest = require('../helpers/MockRequest')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const HttpErrors = require('@overleaf/o-error/http')

describe('HttpErrorController', function() {
  beforeEach(function() {
    this.req = new MockRequest()
    this.res = new MockResponse()

    this.AuthenticationController = {
      getLoggedInUserId: sinon.stub().returns(null)
    }

    this.logger = {
      warn: sinon.stub(),
      error: sinon.stub()
    }

    this.ErrorController = SandboxedModule.require(modulePath, {
      globals: { console },
      requires: {
        '../Authentication/AuthenticationController': this
          .AuthenticationController,
        'logger-sharelatex': this.logger,
        './Errors': Errors,
        '@overleaf/o-error/http': HttpErrors
      }
    })
  })

  describe('handleError', function() {
    beforeEach(function() {})

    it('logs and return status code', function() {
      let error = new HttpErrors.UnprocessableEntityError()

      this.ErrorController.handleError(error, this.req, this.res)
      expect(this.res.statusCode).to.equal(422)
      sinon.assert.calledOnce(this.logger.warn)

      const { url, method, userId } = this.logger.warn.lastCall.args[0]
      expect(userId).to.not.be.defined
      expect(method).to.not.be.defined
      expect(url).to.not.be.defined
    })

    it('logs url method and userId', function() {
      let error = new HttpErrors.UnprocessableEntityError()
      this.AuthenticationController.getLoggedInUserId.returns('123abc')
      this.req.url = 'overleaf.url'
      this.req.method = 'GET'

      this.ErrorController.handleError(error, this.req, this.res)

      const { url, method, userId } = this.logger.warn.lastCall.args[0]
      expect(userId).to.equal('123abc')
      expect(method).to.equal('GET')
      expect(url).to.equal('overleaf.url')
    })

    it('logs and return status code when wrapped', function() {
      let cause = new Errors.SubscriptionAdminDeletionError()
      let error = new HttpErrors.UnprocessableEntityError({}).withCause(cause)

      this.ErrorController.handleError(error, this.req, this.res)
      expect(this.res.statusCode).to.equal(422)
      sinon.assert.calledOnce(this.logger.warn)
    })

    it('renders JSON with info', function() {
      let cause = new Errors.SubscriptionAdminDeletionError({
        info: {
          public: { some: 'data' }
        }
      })
      let error = new HttpErrors.UnprocessableEntityError({
        info: { public: { overwrite: 'data' } }
      }).withCause(cause)
      this.req.accepts = () => 'json'

      this.ErrorController.handleError(error, this.req, this.res)
      expect(this.res.statusCode).to.equal(422)
      expect(this.res.body).to.equal(
        JSON.stringify({
          overwrite: 'data'
        })
      )
    })

    it('renders HTML with info', function() {
      let cause = new Errors.SubscriptionAdminDeletionError()
      let error = new HttpErrors.UnprocessableEntityError({}).withCause(cause)
      this.req.accepts = () => 'html'

      this.ErrorController.handleError(error, this.req, this.res)
      expect(this.res.statusCode).to.equal(422)
      expect(this.res.renderedTemplate).to.equal('general/500')
      expect(this.res.renderedVariables).to.deep.equal({
        title: 'Client Error'
      })
    })
  })
})
