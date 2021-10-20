/* eslint-disable
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const assertCalledWith = sinon.assert.calledWith
const { expect } = require('chai')
const modulePath = '../../../../app/src/infrastructure/ProxyManager'
const SandboxedModule = require('sandboxed-module')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')

describe('ProxyManager', function () {
  beforeEach(function () {
    this.settings = { proxyUrls: {} }
    this.request = sinon.stub().returns({
      on() {},
      pipe() {},
    })
    this.proxyManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': this.settings,
        request: this.request,
      },
    })
    this.proxyPath = '/foo/bar'
    this.req = new MockRequest()
    this.res = new MockResponse()
    return (this.next = sinon.stub())
  })

  describe('apply', function () {
    it('applies all paths', function () {
      this.router = { get: sinon.stub() }
      this.settings.proxyUrls = {
        '/foo/bar': '',
        '/foo/:id': '',
      }
      this.proxyManager.apply(this.router)
      sinon.assert.calledTwice(this.router.get)
      assertCalledWith(this.router.get, '/foo/bar')
      return assertCalledWith(this.router.get, '/foo/:id')
    })

    it('applies methods other than get', function () {
      this.router = {
        post: sinon.stub(),
        put: sinon.stub(),
      }
      this.settings.proxyUrls = {
        '/foo/bar': { options: { method: 'post' } },
        '/foo/:id': { options: { method: 'put' } },
      }
      this.proxyManager.apply(this.router)
      sinon.assert.calledOnce(this.router.post)
      sinon.assert.calledOnce(this.router.put)
      assertCalledWith(this.router.post, '/foo/bar')
      return assertCalledWith(this.router.put, '/foo/:id')
    })
  })

  describe('createProxy', function () {
    beforeEach(function () {
      this.req.url = this.proxyPath
      this.req.route.path = this.proxyPath
      this.req.query = {}
      this.req.params = {}
      this.req.headers = {}
      return (this.settings.proxyUrls = {})
    })

    afterEach(function () {
      this.next.reset()
      return this.request.reset()
    })

    it('proxy full URL', function () {
      const targetUrl = 'https://user:pass@foo.bar:123/pa/th.ext?query#hash'
      this.settings.proxyUrls[this.proxyPath] = targetUrl
      this.proxyManager.createProxy(targetUrl)(this.req)
      return assertCalledWith(this.request, { url: targetUrl })
    })

    it('overwrite query', function () {
      const targetUrl = 'https://foo.bar/baz?query'
      this.req.query = { requestQuery: 'important' }
      this.settings.proxyUrls[this.proxyPath] = targetUrl
      this.proxyManager.createProxy(targetUrl)(this.req)
      const newTargetUrl = 'https://foo.bar/baz?requestQuery=important'
      return assertCalledWith(this.request, { url: newTargetUrl })
    })

    it('handles target objects', function () {
      const target = { baseUrl: 'https://api.v1', path: '/pa/th' }
      this.settings.proxyUrls[this.proxyPath] = target
      this.proxyManager.createProxy(target)(this.req, this.res, this.next)
      return assertCalledWith(this.request, { url: 'https://api.v1/pa/th' })
    })

    it('handles missing baseUrl', function () {
      const target = { path: '/pa/th' }
      this.settings.proxyUrls[this.proxyPath] = target
      expect(() =>
        this.proxyManager.createProxy(target)(this.req, this.res, this.next)
      ).to.throw
    })

    it('handles dynamic path', function () {
      const target = {
        baseUrl: 'https://api.v1',
        path(params) {
          return `/resource/${params.id}`
        },
      }
      this.settings.proxyUrls['/res/:id'] = target
      this.req.url = '/res/123'
      this.req.route.path = '/res/:id'
      this.req.params = { id: 123 }
      this.proxyManager.createProxy(target)(this.req, this.res, this.next)
      return assertCalledWith(this.request, {
        url: 'https://api.v1/resource/123',
      })
    })

    it('set arbitrary options on request', function () {
      const target = {
        baseUrl: 'https://api.v1',
        path: '/foo',
        options: { foo: 'bar' },
      }
      this.req.url = '/foo'
      this.req.route.path = '/foo'
      this.proxyManager.createProxy(target)(this.req, this.res, this.next)
      return assertCalledWith(this.request, {
        foo: 'bar',
        url: 'https://api.v1/foo',
      })
    })

    it('passes cookies', function () {
      const target = { baseUrl: 'https://api.v1', path: '/foo' }
      this.req.url = '/foo'
      this.req.route.path = '/foo'
      this.req.headers = { cookie: 'cookie' }
      this.proxyManager.createProxy(target)(this.req, this.res, this.next)
      return assertCalledWith(this.request, {
        headers: {
          Cookie: 'cookie',
        },
        url: 'https://api.v1/foo',
      })
    })

    it('passes body for post', function () {
      const target = {
        baseUrl: 'https://api.v1',
        path: '/foo',
        options: { method: 'post' },
      }
      this.req.url = '/foo'
      this.req.route.path = '/foo'
      this.req.body = { foo: 'bar' }
      this.proxyManager.createProxy(target)(this.req, this.res, this.next)
      return assertCalledWith(this.request, {
        form: {
          foo: 'bar',
        },
        method: 'post',
        url: 'https://api.v1/foo',
      })
    })

    it('passes body for put', function () {
      const target = {
        baseUrl: 'https://api.v1',
        path: '/foo',
        options: { method: 'put' },
      }
      this.req.url = '/foo'
      this.req.route.path = '/foo'
      this.req.body = { foo: 'bar' }
      this.proxyManager.createProxy(target)(this.req, this.res, this.next)
      return assertCalledWith(this.request, {
        form: {
          foo: 'bar',
        },
        method: 'put',
        url: 'https://api.v1/foo',
      })
    })
  })
})
