const { expect } = require('chai')
const MockResponse = require('../helpers/MockResponse')
const MockRequest = require('../helpers/MockRequest')
const SandboxedModule = require('sandboxed-module')
const modulePath = '../../../../app/src/Features/Errors/HttpErrorHandler.js'

describe('HttpErrorHandler', function() {
  beforeEach(function() {
    this.req = new MockRequest()
    this.res = new MockResponse()

    this.HttpErrorHandler = SandboxedModule.require(modulePath, {
      globals: { console }
    })
  })

  describe('badRequest', function() {
    it('returns 400', function() {
      this.HttpErrorHandler.badRequest(this.req, this.res)
      expect(this.res.statusCode).to.equal(400)
    })

    it('should print a message when no content-type is included', function() {
      this.HttpErrorHandler.badRequest(this.req, this.res)
      expect(this.res.body).to.equal('client error')
    })

    it("should render a template including the error message when content-type is 'html'", function() {
      this.req.accepts = () => 'html'
      this.HttpErrorHandler.badRequest(this.req, this.res, 'an error')
      expect(this.res.renderedTemplate).to.equal('general/400')
      expect(this.res.renderedVariables).to.deep.equal({
        title: 'Client Error',
        message: 'an error'
      })
    })

    it("should render a default template when content-type is 'html' and no message is provided", function() {
      this.req.accepts = () => 'html'
      this.HttpErrorHandler.badRequest(this.req, this.res)
      expect(this.res.renderedTemplate).to.equal('general/400')
      expect(this.res.renderedVariables).to.deep.equal({
        title: 'Client Error',
        message: undefined
      })
    })

    it("should return a json object when content-type is 'json'", function() {
      this.req.accepts = () => 'json'
      this.HttpErrorHandler.badRequest(this.req, this.res, 'an error', {
        foo: 'bar'
      })
      expect(JSON.parse(this.res.body)).to.deep.equal({
        message: 'an error',
        foo: 'bar'
      })
    })

    it("should return an empty json object when content-type is 'json' and no message and info are provided", function() {
      this.req.accepts = () => 'json'
      this.HttpErrorHandler.badRequest(this.req, this.res)
      expect(JSON.parse(this.res.body)).to.deep.equal({})
    })
  })

  describe('forbidden', function() {
    it('returns 403', function() {
      this.HttpErrorHandler.forbidden(this.req, this.res)
      expect(this.res.statusCode).to.equal(403)
    })

    it('should print a message when no content-type is included', function() {
      this.HttpErrorHandler.forbidden(this.req, this.res)
      expect(this.res.body).to.equal('restricted')
    })

    it("should render a template when content-type is 'html'", function() {
      this.req.accepts = () => 'html'
      this.HttpErrorHandler.forbidden(this.req, this.res)
      expect(this.res.renderedTemplate).to.equal('user/restricted')
      expect(this.res.renderedVariables).to.deep.equal({
        title: 'restricted'
      })
    })

    it("should return a json object when content-type is 'json'", function() {
      this.req.accepts = () => 'json'
      this.HttpErrorHandler.forbidden(this.req, this.res, 'an error', {
        foo: 'bar'
      })
      expect(JSON.parse(this.res.body)).to.deep.equal({
        message: 'an error',
        foo: 'bar'
      })
    })
  })

  describe('unprocessableEntity', function() {
    it('returns 422', function() {
      this.HttpErrorHandler.unprocessableEntity(this.req, this.res)
      expect(this.res.statusCode).to.equal(422)
    })

    it('should print a message when no content-type is included', function() {
      this.HttpErrorHandler.unprocessableEntity(this.req, this.res)
      expect(this.res.body).to.equal('unprocessable entity')
    })

    it("should render a template including the error message when content-type is 'html'", function() {
      this.req.accepts = () => 'html'
      this.HttpErrorHandler.unprocessableEntity(this.req, this.res, 'an error')
      expect(this.res.renderedTemplate).to.equal('general/400')
      expect(this.res.renderedVariables).to.deep.equal({
        title: 'Client Error',
        message: 'an error'
      })
    })

    it("should return a json object when content-type is 'json'", function() {
      this.req.accepts = () => 'json'
      this.HttpErrorHandler.unprocessableEntity(
        this.req,
        this.res,
        'an error',
        {
          foo: 'bar'
        }
      )
      expect(JSON.parse(this.res.body)).to.deep.equal({
        message: 'an error',
        foo: 'bar'
      })
    })
  })
})
