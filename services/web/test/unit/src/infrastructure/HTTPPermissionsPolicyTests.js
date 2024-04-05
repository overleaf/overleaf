const { expect } = require('chai')
const sinon = require('sinon')
const modulePath = '../../../../app/src/infrastructure/HttpPermissionsPolicy.js'
const SandboxedModule = require('sandboxed-module')
const HttpPermissionsPolicyMiddleware = require('../../../../app/src/infrastructure/HttpPermissionsPolicy')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')

describe('HttpPermissionsPolicy', function () {
  this.beforeEach(function () {
    this.next = sinon.stub()
    this.HttpPermissionsPolicy = SandboxedModule.require(modulePath, {})
    this.path = '/foo/bar'
    this.req = new MockRequest()
    return (this.res = new MockResponse())
  })

  describe('when a single blocked policy element is provided', function () {
    it('returns a valid header string', function () {
      const policy = {
        blocked: ['accelerometer'],
      }
      const httpPermissionsMiddleware = new HttpPermissionsPolicyMiddleware(
        policy
      )
      return expect(httpPermissionsMiddleware.policy).to.equal(
        'accelerometer=()'
      )
    })
  })

  describe('when a single allowed policy element is provided', function () {
    it('returns a valid header string', function () {
      const policy = {
        allowed: { camera: 'self' },
      }
      const httpPermissionsMiddleware = new HttpPermissionsPolicyMiddleware(
        policy
      )
      return expect(httpPermissionsMiddleware.policy).to.equal('camera=(self)')
    })
  })

  describe('when a full policy is provided', function () {
    it('returns a valid header string', function () {
      const policy = {
        blocked: ['usb', 'hid'],
        allowed: { camera: 'self https://example.com', fullscreen: 'self' },
      }
      const httpPermissionsMiddleware = new HttpPermissionsPolicyMiddleware(
        policy
      )
      return expect(httpPermissionsMiddleware.policy).to.equal(
        'usb=(), hid=(), camera=(self https://example.com), fullscreen=(self)'
      )
    })
  })

  describe('when a conflicting policy is provided', function () {
    it('returns an error', function () {
      const policy = {
        blocked: ['usb'],
        allowed: { usb: 'self' },
      }
      return expect(() => new HttpPermissionsPolicyMiddleware(policy)).to.throw(
        'Invalid Permissions-Policy header configuration'
      )
    })
  })

  describe('when the allowlist contains an incomplete directive', function () {
    it('returns an error', function () {
      const policy = {
        blocked: ['usb'],
        allowed: { camera: '' },
      }
      return expect(() => new HttpPermissionsPolicyMiddleware(policy)).to.throw(
        'Invalid Permissions-Policy header configuration'
      )
    })
  })

  describe('when an empty denylist is provided', function () {
    it('returns a valid header string ', function () {
      const policy = {
        allowed: { camera: 'self' },
        blocked: [],
      }
      const httpPermissionsMiddleware = new HttpPermissionsPolicyMiddleware(
        policy
      )
      return expect(httpPermissionsMiddleware.policy).to.equal('camera=(self)')
    })
  })

  describe('when an empty allowlist is provided', function () {
    it('returns a valid header string ', function () {
      const policy = {
        allowed: {},
        blocked: ['usb'],
      }
      const httpPermissionsMiddleware = new HttpPermissionsPolicyMiddleware(
        policy
      )
      return expect(httpPermissionsMiddleware.policy).to.equal('usb=()')
    })
  })
})
