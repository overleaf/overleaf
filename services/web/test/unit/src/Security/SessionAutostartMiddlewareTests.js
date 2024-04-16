const sinon = require('sinon')
const { expect } = require('chai')
const modulePath =
  '../../../../app/src/infrastructure/SessionAutostartMiddleware.js'
const SandboxedModule = require('sandboxed-module')

describe('SessionAutostartMiddleware', function () {
  let SessionAutostartMiddleware, middleware, Settings
  const cookieName = 'coookieee'
  const excludedRoute = '/wombat/potato'
  const excludedMethod = 'POST'
  const excludedCallback = () => 'call me'

  beforeEach(function () {
    Settings = {
      cookieName,
    }

    SessionAutostartMiddleware = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': Settings,
      },
    })

    middleware = new SessionAutostartMiddleware()
    middleware.disableSessionAutostartForRoute(
      excludedRoute,
      excludedMethod,
      excludedCallback
    )
  })

  describe('middleware', function () {
    let req, next

    beforeEach(function () {
      req = {
        path: excludedRoute,
        method: excludedMethod,
        signedCookies: {},
        headers: {},
      }
      next = sinon.stub()
    })

    it('executes the callback for the excluded route', function () {
      middleware.middleware(req, {}, next)
      expect(req.session.noSessionCallback).to.equal(excludedCallback)
    })

    it('does not execute the callback for the excluded route with ?autostartSession=true set', function () {
      req.query = { autostartSession: 'true' }
      middleware.middleware(req, {}, next)
      expect(req.session).not.to.exist
    })

    it('does not execute the callback if the method is not excluded', function () {
      req.method = 'GET'
      middleware.middleware(req, {}, next)
      expect(req.session).not.to.exist
    })

    it('does not execute the callback if the method is not excluded and ?autostartSession=true is set', function () {
      req.method = 'GET'
      req.query = { autostartSession: 'true' }
      middleware.middleware(req, {}, next)
      expect(req.session).not.to.exist
    })

    it('does not execute the callback if the path is not excluded', function () {
      req.path = '/giraffe'
      middleware.middleware(req, {}, next)
      expect(req.session).not.to.exist
    })

    it('does not execute the callback if there is a cookie', function () {
      req.signedCookies[cookieName] = 'a very useful session cookie'
      middleware.middleware(req, {}, next)
      expect(req.session).not.to.exist
    })
  })
  describe('bot middlewear', function () {
    let req, next

    beforeEach(function () {
      req = {
        signedCookies: {},
        headers: {},
      }
      next = sinon.stub()
    })

    it('GoogleHC user agent should have an empty session', function () {
      req.headers['user-agent'] = 'GoogleHC'
      middleware.middleware(req, {}, next)
      expect(req.session.noSessionCallback).to.deep.exist
    })

    it('should not add empty session with a firefox useragent', function () {
      req.headers['user-agent'] = 'firefox'
      middleware.middleware(req, {}, next)
      expect(req.session).not.to.exist
    })

    it('should not add empty session  with a empty useragent', function () {
      middleware.middleware(req, {}, next)
      expect(req.session).not.to.exist
    })
  })
})
