const Metrics = require('./index')

module.exports.monitor = logger =>
  function(req, res, next) {
    const startTime = Date.now()
    const { end } = res
    res.end = function(...args) {
      end.apply(this, args)
      const responseTimeMs = Date.now() - startTime
      const requestSize = parseInt(req.headers['content-length'], 10)
      const routePath = getRoutePath(req)
      const reqUrl = req.originalUrl || req.url

      if (routePath != null) {
        Metrics.timing('http_request', responseTimeMs, null, {
          method: req.method,
          status_code: res.statusCode,
          path: routePath
        })
        if (requestSize) {
          Metrics.summary('http_request_size_bytes', requestSize, {
            method: req.method,
            status_code: res.statusCode,
            path: routePath
          })
        }
      }
      logger.info({ req, res, responseTimeMs }, '%s %s', req.method, reqUrl)
    }
    next()
  }

function getRoutePath(req) {
  if (req.route && req.route.path != null) {
    return req.route.path
      .toString()
      .replace(/\//g, '_')
      .replace(/:/g, '')
      .slice(1)
  }
  if (req.swagger && req.swagger.apiPath != null) {
    return req.swagger.apiPath
  }
  return null
}
