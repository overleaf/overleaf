const accepts = require('accepts')
const { expect } = require('chai')
const MODULE_PATH =
  '../../../../app/src/infrastructure/RequestContentTypeDetection.js'
const MockRequest = require('../helpers/MockRequest')
const SandboxedModule = require('sandboxed-module')

describe('RequestContentTypeDetection', function () {
  before(function () {
    this.RequestContentTypeDetection = SandboxedModule.require(MODULE_PATH)
    this.req = new MockRequest()
    this.req.accepts = function (...args) {
      return accepts(this).type(...args)
    }
  })

  describe('isJson=true', function () {
    function expectJson(type) {
      it(type, function () {
        this.req.headers.accept = type
        expect(this.RequestContentTypeDetection.acceptsJson(this.req)).to.equal(
          true
        )
      })
    }

    expectJson('application/json')
    expectJson('application/json, text/plain, */*')
    expectJson('application/json, text/html, */*')
  })

  describe('isJson=false', function () {
    function expectNonJson(type) {
      it(type, function () {
        this.req.headers.accept = type
        expect(this.RequestContentTypeDetection.acceptsJson(this.req)).to.equal(
          false
        )
      })
    }

    expectNonJson('*/*')
    expectNonJson('text/html')
    expectNonJson('text/html, application/json')
    expectNonJson('image/png')
  })
})
