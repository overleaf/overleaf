import { expect, vi } from 'vitest'
import sinon from 'sinon'
import HttpPermissionsPolicyMiddleware from '../../../../app/src/infrastructure/HttpPermissionsPolicy.mjs'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'
const modulePath =
  '../../../../app/src/infrastructure/HttpPermissionsPolicy.mjs'

describe('HttpPermissionsPolicy', function () {
  beforeEach(async function (ctx) {
    ctx.next = sinon.stub()
    ctx.HttpPermissionsPolicy = (await import(modulePath)).default
    ctx.path = '/foo/bar'
    ctx.req = new MockRequest(vi)
    ctx.res = new MockResponse(vi)
  })

  describe('when a single blocked policy element is provided', function () {
    it('returns a valid header string', function () {
      const policy = {
        blocked: ['accelerometer'],
      }
      const httpPermissionsMiddleware = new HttpPermissionsPolicyMiddleware(
        policy
      )
      expect(httpPermissionsMiddleware.policy).to.equal('accelerometer=()')
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
      expect(httpPermissionsMiddleware.policy).to.equal('camera=(self)')
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
      expect(httpPermissionsMiddleware.policy).to.equal(
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
      expect(() => new HttpPermissionsPolicyMiddleware(policy)).to.throw(
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
      expect(() => new HttpPermissionsPolicyMiddleware(policy)).to.throw(
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
      expect(httpPermissionsMiddleware.policy).to.equal('camera=(self)')
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
      expect(httpPermissionsMiddleware.policy).to.equal('usb=()')
    })
  })
})
