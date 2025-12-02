import { vi, expect } from 'vitest'
import MockResponse from '../helpers/MockResponse.mjs'
import MockRequest from '../helpers/MockRequest.mjs'
const modulePath = '../../../../app/src/Features/Errors/HttpErrorHandler.mjs'

describe('HttpErrorHandler', function () {
  beforeEach(async function (ctx) {
    ctx.req = new MockRequest(vi)
    ctx.res = new MockResponse(vi)

    vi.doMock('@overleaf/settings', () => ({
      default: {
        appName: 'Overleaf',
        statusPageUrl: 'https://status.overlaf.com',
      },
    }))

    ctx.HttpErrorHandler = (await import(modulePath)).default
  })

  describe('handleErrorByStatusCode', function () {
    it('returns the http status code of 400 errors', function (ctx) {
      const err = new Error()
      ctx.HttpErrorHandler.handleErrorByStatusCode(ctx.req, ctx.res, err, 400)
      expect(ctx.res.statusCode).to.equal(400)
    })

    it('returns the http status code of 500 errors', function (ctx) {
      const err = new Error()
      ctx.HttpErrorHandler.handleErrorByStatusCode(ctx.req, ctx.res, err, 500)
      expect(ctx.res.statusCode).to.equal(500)
    })

    it('returns the http status code of any 5xx error', function (ctx) {
      const err = new Error()
      ctx.HttpErrorHandler.handleErrorByStatusCode(ctx.req, ctx.res, err, 588)
      expect(ctx.res.statusCode).to.equal(588)
    })

    it('returns the http status code of any 4xx error', function (ctx) {
      const err = new Error()
      ctx.HttpErrorHandler.handleErrorByStatusCode(ctx.req, ctx.res, err, 488)
      expect(ctx.res.statusCode).to.equal(488)
    })

    it('returns 500 for http status codes smaller than 400', function (ctx) {
      const err = new Error()
      ctx.HttpErrorHandler.handleErrorByStatusCode(ctx.req, ctx.res, err, 302)
      expect(ctx.res.statusCode).to.equal(500)
    })

    it('returns 500 for http status codes larger than 600', function (ctx) {
      const err = new Error()
      ctx.HttpErrorHandler.handleErrorByStatusCode(ctx.req, ctx.res, err, 302)
      expect(ctx.res.statusCode).to.equal(500)
    })

    it('returns 500 when the error has no http status code', function (ctx) {
      const err = new Error()
      ctx.HttpErrorHandler.handleErrorByStatusCode(ctx.req, ctx.res, err)
      expect(ctx.res.statusCode).to.equal(500)
    })

    it('uses the conflict() error handler', function (ctx) {
      const err = new Error()
      ctx.HttpErrorHandler.handleErrorByStatusCode(ctx.req, ctx.res, err, 409)
      expect(ctx.res.body).to.equal('conflict')
    })

    it('uses the forbidden() error handler', function (ctx) {
      const err = new Error()
      ctx.HttpErrorHandler.handleErrorByStatusCode(ctx.req, ctx.res, err, 403)
      expect(ctx.res.body).to.equal('restricted')
    })

    it('uses the notFound() error handler', function (ctx) {
      const err = new Error()
      ctx.HttpErrorHandler.handleErrorByStatusCode(ctx.req, ctx.res, err, 404)
      expect(ctx.res.body).to.equal('not found')
    })

    it('uses the unprocessableEntity() error handler', function (ctx) {
      const err = new Error()
      err.httpStatusCode = 422
      ctx.HttpErrorHandler.handleErrorByStatusCode(ctx.req, ctx.res, err, 422)
      expect(ctx.res.body).to.equal('unprocessable entity')
    })
  })

  describe('badRequest', function () {
    it('returns 400', function (ctx) {
      ctx.HttpErrorHandler.badRequest(ctx.req, ctx.res)
      expect(ctx.res.statusCode).to.equal(400)
    })

    it('should print a message when no content-type is included', function (ctx) {
      ctx.HttpErrorHandler.badRequest(ctx.req, ctx.res)
      expect(ctx.res.body).to.equal('client error')
    })

    it("should render a template including the error message when content-type is 'html'", function (ctx) {
      ctx.req.accepts = () => 'html'
      ctx.HttpErrorHandler.badRequest(ctx.req, ctx.res, 'an error')
      expect(ctx.res.renderedTemplate).to.equal('general/400')
      expect(ctx.res.renderedVariables).to.deep.equal({
        title: 'Client Error',
        message: 'an error',
      })
    })

    it("should render a default template when content-type is 'html' and no message is provided", function (ctx) {
      ctx.req.accepts = () => 'html'
      ctx.HttpErrorHandler.badRequest(ctx.req, ctx.res)
      expect(ctx.res.renderedTemplate).to.equal('general/400')
      expect(ctx.res.renderedVariables).to.deep.equal({
        title: 'Client Error',
        message: undefined,
      })
    })

    it("should return a json object when content-type is 'json'", function (ctx) {
      ctx.req.accepts = () => 'json'
      ctx.HttpErrorHandler.badRequest(ctx.req, ctx.res, 'an error', {
        foo: 'bar',
      })
      expect(JSON.parse(ctx.res.body)).to.deep.equal({
        message: 'an error',
        foo: 'bar',
      })
    })

    it("should return an empty json object when content-type is 'json' and no message and info are provided", function (ctx) {
      ctx.req.accepts = () => 'json'
      ctx.HttpErrorHandler.badRequest(ctx.req, ctx.res)
      expect(JSON.parse(ctx.res.body)).to.deep.equal({})
    })
  })

  describe('conflict', function () {
    it('returns 409', function (ctx) {
      ctx.HttpErrorHandler.conflict(ctx.req, ctx.res)
      expect(ctx.res.statusCode).to.equal(409)
    })

    it('should print a message when no content-type is included', function (ctx) {
      ctx.HttpErrorHandler.conflict(ctx.req, ctx.res)
      expect(ctx.res.body).to.equal('conflict')
    })

    it("should render a template including the error message when content-type is 'html'", function (ctx) {
      ctx.req.accepts = () => 'html'
      ctx.HttpErrorHandler.unprocessableEntity(ctx.req, ctx.res, 'an error')
      expect(ctx.res.renderedTemplate).to.equal('general/400')
      expect(ctx.res.renderedVariables).to.deep.equal({
        title: 'Client Error',
        message: 'an error',
      })
    })

    it("should return a json object when content-type is 'json'", function (ctx) {
      ctx.req.accepts = () => 'json'
      ctx.HttpErrorHandler.unprocessableEntity(ctx.req, ctx.res, 'an error', {
        foo: 'bar',
      })
      expect(JSON.parse(ctx.res.body)).to.deep.equal({
        message: 'an error',
        foo: 'bar',
      })
    })
  })

  describe('forbidden', function () {
    it('returns 403', function (ctx) {
      ctx.HttpErrorHandler.forbidden(ctx.req, ctx.res)
      expect(ctx.res.statusCode).to.equal(403)
    })

    it('should print a message when no content-type is included', function (ctx) {
      ctx.HttpErrorHandler.forbidden(ctx.req, ctx.res)
      expect(ctx.res.body).to.equal('restricted')
    })

    it("should render a template when content-type is 'html'", function (ctx) {
      ctx.req.accepts = () => 'html'
      ctx.HttpErrorHandler.forbidden(ctx.req, ctx.res)
      expect(ctx.res.renderedTemplate).to.equal('user/restricted')
      expect(ctx.res.renderedVariables).to.deep.equal({
        title: 'restricted',
      })
    })

    it("should return a json object when content-type is 'json'", function (ctx) {
      ctx.req.accepts = () => 'json'
      ctx.HttpErrorHandler.forbidden(ctx.req, ctx.res, 'an error', {
        foo: 'bar',
      })
      expect(JSON.parse(ctx.res.body)).to.deep.equal({
        message: 'an error',
        foo: 'bar',
      })
    })
  })

  describe('notFound', function () {
    it('returns 404', function (ctx) {
      ctx.HttpErrorHandler.notFound(ctx.req, ctx.res)
      expect(ctx.res.statusCode).to.equal(404)
    })

    it('should print a message when no content-type is included', function (ctx) {
      ctx.HttpErrorHandler.notFound(ctx.req, ctx.res)
      expect(ctx.res.body).to.equal('not found')
    })

    it("should render a template when content-type is 'html'", function (ctx) {
      ctx.req.accepts = () => 'html'
      ctx.HttpErrorHandler.notFound(ctx.req, ctx.res)
      expect(ctx.res.renderedTemplate).to.equal('general/404')
      expect(ctx.res.renderedVariables).to.deep.equal({
        title: 'page_not_found',
      })
    })

    it("should return a json object when content-type is 'json'", function (ctx) {
      ctx.req.accepts = () => 'json'
      ctx.HttpErrorHandler.notFound(ctx.req, ctx.res, 'an error', {
        foo: 'bar',
      })
      expect(JSON.parse(ctx.res.body)).to.deep.equal({
        message: 'an error',
        foo: 'bar',
      })
    })
  })

  describe('unprocessableEntity', function () {
    it('returns 422', function (ctx) {
      ctx.HttpErrorHandler.unprocessableEntity(ctx.req, ctx.res)
      expect(ctx.res.statusCode).to.equal(422)
    })

    it('should print a message when no content-type is included', function (ctx) {
      ctx.HttpErrorHandler.unprocessableEntity(ctx.req, ctx.res)
      expect(ctx.res.body).to.equal('unprocessable entity')
    })

    it("should render a template including the error message when content-type is 'html'", function (ctx) {
      ctx.req.accepts = () => 'html'
      ctx.HttpErrorHandler.unprocessableEntity(ctx.req, ctx.res, 'an error')
      expect(ctx.res.renderedTemplate).to.equal('general/400')
      expect(ctx.res.renderedVariables).to.deep.equal({
        title: 'Client Error',
        message: 'an error',
      })
    })

    it("should return a json object when content-type is 'json'", function (ctx) {
      ctx.req.accepts = () => 'json'
      ctx.HttpErrorHandler.unprocessableEntity(ctx.req, ctx.res, 'an error', {
        foo: 'bar',
      })
      expect(JSON.parse(ctx.res.body)).to.deep.equal({
        message: 'an error',
        foo: 'bar',
      })
    })

    describe('legacyInternal', function () {
      it('returns 500', function (ctx) {
        ctx.HttpErrorHandler.legacyInternal(ctx.req, ctx.res, new Error())
        expect(ctx.res.statusCode).to.equal(500)
      })

      it('should send the error to the logger', function (ctx) {
        const error = new Error('message')
        ctx.HttpErrorHandler.legacyInternal(ctx.req, ctx.res, 'message', error)
        expect(ctx.req.logger.setLevel).toHaveBeenCalledWith('error')
        expect(ctx.req.logger.addFields).toHaveBeenCalledWith({
          err: error,
        })
      })

      it('should print a message when no content-type is included', function (ctx) {
        ctx.HttpErrorHandler.legacyInternal(ctx.req, ctx.res, new Error())
        expect(ctx.res.body).to.equal('internal server error')
      })

      it("should render a template when content-type is 'html'", function (ctx) {
        ctx.req.accepts = () => 'html'
        ctx.HttpErrorHandler.legacyInternal(ctx.req, ctx.res, new Error())
        expect(ctx.res.renderedTemplate).to.equal('general/500')
        expect(ctx.res.renderedVariables).to.deep.equal({
          title: 'Server Error',
        })
      })

      it("should return a json object with a static message when content-type is 'json'", function (ctx) {
        ctx.req.accepts = () => 'json'
        ctx.HttpErrorHandler.legacyInternal(
          ctx.req,
          ctx.res,
          'a message',
          new Error()
        )
        expect(JSON.parse(ctx.res.body)).to.deep.equal({
          message: 'a message',
        })
      })
    })
  })
})
