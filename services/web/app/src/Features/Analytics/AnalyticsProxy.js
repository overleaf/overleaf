const settings = require('@overleaf/settings')
const Errors = require('../Errors/Errors')
const httpProxy = require('express-http-proxy')
const { URL } = require('url')

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
        const u = new URL(req.originalUrl, settings.siteUrl)
        const requestPath = u.pathname + u.search
        return `${basePath}${requestPath}`
      },
      proxyReqOptDecorator(proxyReqOpts, srcReq) {
        proxyReqOpts.headers = {} // unset all headers
        return proxyReqOpts
      },
    })
  },
}
