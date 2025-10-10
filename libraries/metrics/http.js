const Metrics = require('./index')

function monitor(logger, level = 'debug') {
  return function (req, res, next) {
    const startTime = Date.now()
    req.logger = new RequestLogger(logger, level)
    const { end } = res
    res.end = function (...args) {
      end.apply(this, args)
      const responseTimeMs = Date.now() - startTime
      const requestSize = parseInt(req.headers['content-length'], 10)
      const routePath = getRoutePath(req)

      if (routePath != null) {
        Metrics.timing('http_request', responseTimeMs, null, {
          method: req.method,
          status_code: res.statusCode,
          path: routePath,
        })
        if (requestSize) {
          Metrics.summary('http_request_size_bytes', requestSize, {
            method: req.method,
            status_code: res.statusCode,
            path: routePath,
          })
        }
      }
      req.logger.addFields({ responseTimeMs })
      req.logger.emit(req, res)
    }
    next()
  }
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

class RequestLogger {
  constructor(logger, level) {
    this._logger = logger
    this._level = level
    this._info = {}
  }

  addFields(fields) {
    Object.assign(this._info, fields)
  }

  setLevel(level) {
    this._level = level
  }

  disable() {
    this._disabled = true
  }

  emit(req, res) {
    if (this._disabled) {
      return
    }
    this.addFields({ req, res })
    const url = req.originalUrl || req.url
    this._logger[this._level](this._info, '%s %s', req.method, url)
  }
}

module.exports = { monitor, RequestLogger }
