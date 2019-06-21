const settings = require('settings-sharelatex')
const Errors = require('../Errors/Errors')
const httpProxy = require('express-http-proxy')
const URL = require('url')

module.exports = {
  call(basePath) {
    if (!settings.apis.analytics) {
      return (req, res, next) =>
        next(
          new Errors.ServiceNotConfiguredError(
            'Analytics service not configured'
          )
        )
    }

    return httpProxy(settings.apis.analytics.url, {
      proxyReqPathResolver(req) {
        const requestPath = URL.parse(req.url).path
        return `${basePath}${requestPath}`
      },
      proxyReqOptDecorator(proxyReqOpts, srcReq) {
        proxyReqOpts.headers = {} // unset all headers
        return proxyReqOpts
      }
    })
  }
}
