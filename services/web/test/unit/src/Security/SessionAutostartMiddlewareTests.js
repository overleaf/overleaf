const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const modulePath =
  '../../../../app/src/infrastructure/SessionAutostartMiddleware.js'
const SandboxedModule = require('sandboxed-module')

describe('SessionAutostartMiddleware', function() {
  let SessionAutostartMiddleware, middleware, Settings
  const cookieName = 'coookieee'
  const excludedRoute = '/wombat/potato'
  const excludedMethod = 'POST'
  const excludedCallback = () => 'call me'

  beforeEach(function() {
    Settings = {
      cookieName: cookieName
    }

    SessionAutostartMiddleware = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': Settings
      }
    })

    middleware = new SessionAutostartMiddleware()
    middleware.disableSessionAutostartForRoute(
      excludedRoute,
      excludedMethod,
      excludedCallback
    )
  })

  describe('middleware', function() {
    let req, next

    beforeEach(function() {
      req = { path: excludedRoute, method: excludedMethod, signedCookies: {} }
      next = sinon.stub()
    })

    it('executes the callback for the excluded route', function() {
      middleware.middleware(req, {}, next)
      expect(req.session.noSessionCallback).to.equal(excludedCallback)
    })

    it('does not execute the callback if the method is not excluded', function() {
      req.method = 'GET'
      middleware.middleware(req, {}, next)
      expect(req.session).not.to.exist
    })

    it('does not execute the callback if the path is not excluded', function() {
      req.path = '/giraffe'
      middleware.middleware(req, {}, next)
      expect(req.session).not.to.exist
    })

    it('does not execute the callback if there is a cookie', function() {
      req.signedCookies[cookieName] = 'a very useful session cookie'
      middleware.middleware(req, {}, next)
      expect(req.session).not.to.exist
    })
  })
})
