/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const settings = require('settings-sharelatex')
const Errors = require('../Errors/Errors')
const httpProxy = require('express-http-proxy')
const URL = require('url')

module.exports = {
  call(basePath) {
    const analyticsUrl = __guard__(
      __guard__(
        settings != null ? settings.apis : undefined,
        x1 => x1.analytics
      ),
      x => x.url
    )
    if (analyticsUrl != null) {
      return httpProxy(analyticsUrl, {
        proxyReqPathResolver(req) {
          const requestPath = URL.parse(req.url).path
          return `${basePath}${requestPath}`
        },
        proxyReqOptDecorator(proxyReqOpts, srcReq) {
          proxyReqOpts.headers = {} // unset all headers
          return proxyReqOpts
        }
      })
    } else {
      return (req, res, next) =>
        next(
          new Errors.ServiceNotConfiguredError(
            'Analytics service not configured'
          )
        )
    }
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
