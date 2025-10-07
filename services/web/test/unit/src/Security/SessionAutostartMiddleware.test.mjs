import { beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
const modulePath =
  '../../../../app/src/infrastructure/SessionAutostartMiddleware.mjs'

describe('SessionAutostartMiddleware', () => {
  let SessionAutostartMiddleware, middleware, Settings
  const cookieName = 'coookieee'
  const excludedRoute = '/wombat/potato'
  const excludedMethod = 'POST'
  const excludedCallback = () => 'call me'

  beforeEach(async () => {
    Settings = {
      cookieName,
    }

    vi.doMock('@overleaf/settings', () => ({
      default: Settings,
    }))

    SessionAutostartMiddleware = (await import(modulePath)).default

    middleware = new SessionAutostartMiddleware()
    middleware.disableSessionAutostartForRoute(
      excludedRoute,
      excludedMethod,
      excludedCallback
    )
  })

  describe('middleware', () => {
    let req, next

    beforeEach(() => {
      req = {
        path: excludedRoute,
        method: excludedMethod,
        signedCookies: {},
        headers: {},
      }
      next = sinon.stub()
    })

    it('executes the callback for the excluded route', () => {
      middleware.middleware(req, {}, next)
      expect(req.session.noSessionCallback).to.equal(excludedCallback)
    })

    it('does not execute the callback for the excluded route with ?autostartSession=true set', () => {
      req.query = { autostartSession: 'true' }
      middleware.middleware(req, {}, next)
      expect(req.session).not.to.exist
    })

    it('does not execute the callback if the method is not excluded', () => {
      req.method = 'GET'
      middleware.middleware(req, {}, next)
      expect(req.session).not.to.exist
    })

    it('does not execute the callback if the method is not excluded and ?autostartSession=true is set', () => {
      req.method = 'GET'
      req.query = { autostartSession: 'true' }
      middleware.middleware(req, {}, next)
      expect(req.session).not.to.exist
    })

    it('does not execute the callback if the path is not excluded', () => {
      req.path = '/giraffe'
      middleware.middleware(req, {}, next)
      expect(req.session).not.to.exist
    })

    it('does not execute the callback if there is a cookie', () => {
      req.signedCookies[cookieName] = 'a very useful session cookie'
      middleware.middleware(req, {}, next)
      expect(req.session).not.to.exist
    })
  })
  describe('bot middlewear', () => {
    let req, next

    beforeEach(() => {
      req = {
        signedCookies: {},
        headers: {},
      }
      next = sinon.stub()
    })

    it('GoogleHC user agent should have an empty session', () => {
      req.headers['user-agent'] = 'GoogleHC'
      middleware.middleware(req, {}, next)
      expect(req.session.noSessionCallback).to.deep.exist
    })

    it('should not add empty session with a firefox useragent', () => {
      req.headers['user-agent'] = 'firefox'
      middleware.middleware(req, {}, next)
      expect(req.session).not.to.exist
    })

    it('should not add empty session  with a empty useragent', () => {
      middleware.middleware(req, {}, next)
      expect(req.session).not.to.exist
    })
  })
})
