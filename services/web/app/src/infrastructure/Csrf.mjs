import csurf from 'csurf'
import { promisify } from 'node:util'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'

const csrf = csurf()

// Wrapper for `csurf` middleware that provides a list of routes that can be excluded from csrf checks.
//
// Include with `Csrf = require('./Csrf')`
//
// Add the middleware to the router with:
//   myRouter.csrf = new Csrf()
//   myRouter.use webRouter.csrf.middleware
// When building routes, specify a route to exclude from csrf checks with:
//   myRouter.csrf.disableDefaultCsrfProtection "/path" "METHOD"
//
// To validate the csrf token in a request to ensure that it's valid, you can use `validateRequest`, which takes a
// request object and calls a callback with an error if invalid.

class Csrf {
  constructor() {
    this.middleware = this.middleware.bind(this)
    this.excluded_routes = {}
  }

  static blockCrossOriginRequests() {
    return function (req, res, next) {
      const { origin } = req.headers
      // NOTE: Only cross-origin requests must have an origin header set.
      if (origin && !Settings.allowedOrigins.includes(origin)) {
        logger.warn({ req }, 'blocking cross-origin request')
        return res.sendStatus(403)
      }
      next()
    }
  }

  disableDefaultCsrfProtection(route, method) {
    if (!this.excluded_routes[route]) {
      this.excluded_routes[route] = {}
    }
    this.excluded_routes[route][method] = 1
  }

  middleware(req, res, next) {
    // We want to call the middleware for all routes, even if excluded, because csurf sets up a csrfToken() method on
    // the request, to get a new csrf token for any rendered forms. For excluded routes we'll then ignore a 'bad csrf
    // token' error from csurf and continue on...

    // check whether the request method is excluded for the specified route
    if (this.excluded_routes[req.path]?.[req.method] === 1) {
      // ignore the error if it's due to a bad csrf token, and continue
      csrf(req, res, err => {
        if (err && err.code !== 'EBADCSRFTOKEN') {
          next(err)
        } else {
          next()
        }
      })
    } else {
      csrf(req, res, next)
    }
  }

  static validateRequest(req, cb) {
    // run a dummy csrf check to see if it returns an error
    if (cb == null) {
      cb = function (valid) {}
    }
    csrf(req, null, err => cb(err))
  }

  static validateToken(token, session, cb) {
    if (token == null) {
      return cb(new Error('missing token'))
    }
    // run a dummy csrf check to see if it returns an error
    // use this to simulate a csrf check regardless of req method, headers &c.
    const req = {
      body: {
        _csrf: token,
      },
      headers: {},
      method: 'POST',
      session,
    }
    Csrf.validateRequest(req, cb)
  }
}

Csrf.promises = {
  validateRequest: promisify(Csrf.validateRequest),
  validateToken: promisify(Csrf.validateToken),
}

export default Csrf
