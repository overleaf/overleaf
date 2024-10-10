import settings from '@overleaf/settings'
import Errors from '../Errors/Errors.js'
import httpProxy from 'express-http-proxy'

export default {
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
        // req.url is the part of the path that comes after the mount point in
        // app.use()
        return `${basePath}${req.url}`
      },
      proxyReqOptDecorator(proxyReqOpts, srcReq) {
        proxyReqOpts.headers = {} // unset all headers
        return proxyReqOpts
      },
    })
  },
}
