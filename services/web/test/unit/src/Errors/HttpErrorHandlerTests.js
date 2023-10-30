const { expect } = require('chai')
const MockResponse = require('../helpers/MockResponse')
const MockRequest = require('../helpers/MockRequest')
const SandboxedModule = require('sandboxed-module')
const modulePath = '../../../../app/src/Features/Errors/HttpErrorHandler.js'

describe('HttpErrorHandler', function () {
  beforeEach(function () {
    this.req = new MockRequest()
    this.res = new MockResponse()

    this.HttpErrorHandler = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': {
          appName: 'Overleaf',
          statusPageUrl: 'https://status.overlaf.com',
        },
      },
    })
  })

  describe('handleErrorByStatusCode', function () {
    it('returns the http status code of 400 errors', function () {
      const err = new Error()
      this.HttpErrorHandler.handleErrorByStatusCode(
        this.req,
        this.res,
        err,
        400
      )
      expect(this.res.statusCode).to.equal(400)
    })

    it('returns the http status code of 500 errors', function () {
      const err = new Error()
      this.HttpErrorHandler.handleErrorByStatusCode(
        this.req,
        this.res,
        err,
        500
      )
      expect(this.res.statusCode).to.equal(500)
    })

    it('returns the http status code of any 5xx error', function () {
      const err = new Error()
      this.HttpErrorHandler.handleErrorByStatusCode(
        this.req,
        this.res,
        err,
        588
      )
      expect(this.res.statusCode).to.equal(588)
    })

    it('returns the http status code of any 4xx error', function () {
      const err = new Error()
      this.HttpErrorHandler.handleErrorByStatusCode(
        this.req,
        this.res,
        err,
        488
      )
      expect(this.res.statusCode).to.equal(488)
    })

    it('returns 500 for http status codes smaller than 400', function () {
      const err = new Error()
      this.HttpErrorHandler.handleErrorByStatusCode(
        this.req,
        this.res,
        err,
        302
      )
      expect(this.res.statusCode).to.equal(500)
    })

    it('returns 500 for http status codes larger than 600', function () {
      const err = new Error()
      this.HttpErrorHandler.handleErrorByStatusCode(
        this.req,
        this.res,
        err,
        302
      )
      expect(this.res.statusCode).to.equal(500)
    })

    it('returns 500 when the error has no http status code', function () {
      const err = new Error()
      this.HttpErrorHandler.handleErrorByStatusCode(this.req, this.res, err)
      expect(this.res.statusCode).to.equal(500)
    })

    it('uses the conflict() error handler', function () {
      const err = new Error()
      this.HttpErrorHandler.handleErrorByStatusCode(
        this.req,
        this.res,
        err,
        409
      )
      expect(this.res.body).to.equal('conflict')
    })

    it('uses the forbidden() error handler', function () {
      const err = new Error()
      this.HttpErrorHandler.handleErrorByStatusCode(
        this.req,
        this.res,
        err,
        403
      )
      expect(this.res.body).to.equal('restricted')
    })

    it('uses the notFound() error handler', function () {
      const err = new Error()
      this.HttpErrorHandler.handleErrorByStatusCode(
        this.req,
        this.res,
        err,
        404
      )
      expect(this.res.body).to.equal('not found')
    })

    it('uses the unprocessableEntity() error handler', function () {
      const err = new Error()
      err.httpStatusCode = 422
      this.HttpErrorHandler.handleErrorByStatusCode(
        this.req,
        this.res,
        err,
        422
      )
      expect(this.res.body).to.equal('unprocessable entity')
    })
  })

  describe('badRequest', function () {
    it('returns 400', function () {
      this.HttpErrorHandler.badRequest(this.req, this.res)
      expect(this.res.statusCode).to.equal(400)
    })

    it('should print a message when no content-type is included', function () {
      this.HttpErrorHandler.badRequest(this.req, this.res)
      expect(this.res.body).to.equal('client error')
    })

    it("should render a template including the error message when content-type is 'html'", function () {
      this.req.accepts = () => 'html'
      this.HttpErrorHandler.badRequest(this.req, this.res, 'an error')
      expect(this.res.renderedTemplate).to.equal('general/400')
      expect(this.res.renderedVariables).to.deep.equal({
        title: 'Client Error',
        message: 'an error',
      })
    })

    it("should render a default template when content-type is 'html' and no message is provided", function () {
      this.req.accepts = () => 'html'
      this.HttpErrorHandler.badRequest(this.req, this.res)
      expect(this.res.renderedTemplate).to.equal('general/400')
      expect(this.res.renderedVariables).to.deep.equal({
        title: 'Client Error',
        message: undefined,
      })
    })

    it("should return a json object when content-type is 'json'", function () {
      this.req.accepts = () => 'json'
      this.HttpErrorHandler.badRequest(this.req, this.res, 'an error', {
        foo: 'bar',
      })
      expect(JSON.parse(this.res.body)).to.deep.equal({
        message: 'an error',
        foo: 'bar',
      })
    })

    it("should return an empty json object when content-type is 'json' and no message and info are provided", function () {
      this.req.accepts = () => 'json'
      this.HttpErrorHandler.badRequest(this.req, this.res)
      expect(JSON.parse(this.res.body)).to.deep.equal({})
    })
  })

  describe('conflict', function () {
    it('returns 409', function () {
      this.HttpErrorHandler.conflict(this.req, this.res)
      expect(this.res.statusCode).to.equal(409)
    })

    it('should print a message when no content-type is included', function () {
      this.HttpErrorHandler.conflict(this.req, this.res)
      expect(this.res.body).to.equal('conflict')
    })

    it("should render a template including the error message when content-type is 'html'", function () {
      this.req.accepts = () => 'html'
      this.HttpErrorHandler.unprocessableEntity(this.req, this.res, 'an error')
      expect(this.res.renderedTemplate).to.equal('general/400')
      expect(this.res.renderedVariables).to.deep.equal({
        title: 'Client Error',
        message: 'an error',
      })
    })

    it("should return a json object when content-type is 'json'", function () {
      this.req.accepts = () => 'json'
      this.HttpErrorHandler.unprocessableEntity(
        this.req,
        this.res,
        'an error',
        {
          foo: 'bar',
        }
      )
      expect(JSON.parse(this.res.body)).to.deep.equal({
        message: 'an error',
        foo: 'bar',
      })
    })
  })

  describe('forbidden', function () {
    it('returns 403', function () {
      this.HttpErrorHandler.forbidden(this.req, this.res)
      expect(this.res.statusCode).to.equal(403)
    })

    it('should print a message when no content-type is included', function () {
      this.HttpErrorHandler.forbidden(this.req, this.res)
      expect(this.res.body).to.equal('restricted')
    })

    it("should render a template when content-type is 'html'", function () {
      this.req.accepts = () => 'html'
      this.HttpErrorHandler.forbidden(this.req, this.res)
      expect(this.res.renderedTemplate).to.equal('user/restricted')
      expect(this.res.renderedVariables).to.deep.equal({
        title: 'restricted',
      })
    })

    it("should return a json object when content-type is 'json'", function () {
      this.req.accepts = () => 'json'
      this.HttpErrorHandler.forbidden(this.req, this.res, 'an error', {
        foo: 'bar',
      })
      expect(JSON.parse(this.res.body)).to.deep.equal({
        message: 'an error',
        foo: 'bar',
      })
    })
  })

  describe('notFound', function () {
    it('returns 404', function () {
      this.HttpErrorHandler.notFound(this.req, this.res)
      expect(this.res.statusCode).to.equal(404)
    })

    it('should print a message when no content-type is included', function () {
      this.HttpErrorHandler.notFound(this.req, this.res)
      expect(this.res.body).to.equal('not found')
    })

    it("should render a template when content-type is 'html'", function () {
      this.req.accepts = () => 'html'
      this.HttpErrorHandler.notFound(this.req, this.res)
      expect(this.res.renderedTemplate).to.equal('general/404')
      expect(this.res.renderedVariables).to.deep.equal({
        title: 'page_not_found',
      })
    })

    it("should return a json object when content-type is 'json'", function () {
      this.req.accepts = () => 'json'
      this.HttpErrorHandler.notFound(this.req, this.res, 'an error', {
        foo: 'bar',
      })
      expect(JSON.parse(this.res.body)).to.deep.equal({
        message: 'an error',
        foo: 'bar',
      })
    })
  })

  describe('unprocessableEntity', function () {
    it('returns 422', function () {
      this.HttpErrorHandler.unprocessableEntity(this.req, this.res)
      expect(this.res.statusCode).to.equal(422)
    })

    it('should print a message when no content-type is included', function () {
      this.HttpErrorHandler.unprocessableEntity(this.req, this.res)
      expect(this.res.body).to.equal('unprocessable entity')
    })

    it("should render a template including the error message when content-type is 'html'", function () {
      this.req.accepts = () => 'html'
      this.HttpErrorHandler.unprocessableEntity(this.req, this.res, 'an error')
      expect(this.res.renderedTemplate).to.equal('general/400')
      expect(this.res.renderedVariables).to.deep.equal({
        title: 'Client Error',
        message: 'an error',
      })
    })

    it("should return a json object when content-type is 'json'", function () {
      this.req.accepts = () => 'json'
      this.HttpErrorHandler.unprocessableEntity(
        this.req,
        this.res,
        'an error',
        {
          foo: 'bar',
        }
      )
      expect(JSON.parse(this.res.body)).to.deep.equal({
        message: 'an error',
        foo: 'bar',
      })
    })

    describe('legacyInternal', function () {
      it('returns 500', function () {
        this.HttpErrorHandler.legacyInternal(this.req, this.res, new Error())
        expect(this.res.statusCode).to.equal(500)
      })

      it('should send the error to the logger', function () {
        const error = new Error('message')
        this.HttpErrorHandler.legacyInternal(
          this.req,
          this.res,
          'message',
          error
        )
        expect(this.req.logger.setLevel).to.have.been.calledWith('error')
        expect(this.req.logger.addFields).to.have.been.calledWith({
          err: error,
        })
      })

      it('should print a message when no content-type is included', function () {
        this.HttpErrorHandler.legacyInternal(this.req, this.res, new Error())
        expect(this.res.body).to.equal('internal server error')
      })

      it("should render a template when content-type is 'html'", function () {
        this.req.accepts = () => 'html'
        this.HttpErrorHandler.legacyInternal(this.req, this.res, new Error())
        expect(this.res.renderedTemplate).to.equal('general/500')
        expect(this.res.renderedVariables).to.deep.equal({
          title: 'Server Error',
        })
      })

      it("should return a json object with a static message when content-type is 'json'", function () {
        this.req.accepts = () => 'json'
        this.HttpErrorHandler.legacyInternal(
          this.req,
          this.res,
          'a message',
          new Error()
        )
        expect(JSON.parse(this.res.body)).to.deep.equal({
          message: 'a message',
        })
      })
    })
  })
})
