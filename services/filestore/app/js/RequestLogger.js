const logger = require('logger-sharelatex')
const metrics = require('@overleaf/metrics')

class RequestLogger {
  constructor() {
    this._logInfo = {}
    this._logMessage = 'http request'
  }

  addFields(fields) {
    Object.assign(this._logInfo, fields)
  }

  setMessage(message) {
    this._logMessage = message
  }

  static errorHandler(err, req, res, next) {
    req.requestLogger.addFields({ error: err })
    res.status(500).send(err.message)
  }

  static middleware(req, res, next) {
    const startTime = new Date()
    req.requestLogger = new RequestLogger()

    // override the 'end' method to log and record metrics
    const end = res.end
    res.end = function () {
      // apply the standard request 'end' method before logging and metrics
      end.apply(this, arguments)

      const responseTime = new Date() - startTime

      const routePath = req.route && req.route.path.toString()

      if (routePath) {
        metrics.timing('http_request', responseTime, null, {
          method: req.method,
          status_code: res.statusCode,
          path: routePath.replace(/\//g, '_').replace(/:/g, '').slice(1),
        })
      }

      const level = res.statusCode >= 500 ? 'err' : 'log'
      logger[level](
        {
          req: {
            url: req.originalUrl || req.url,
            route: routePath,
            method: req.method,
            referrer: req.headers.referer || req.headers.referrer,
            'remote-addr':
              req.ip ||
              (req.socket && req.socket.remoteAddress) ||
              (req.socket &&
                req.socket.socket &&
                req.socket.socket.remoteAddress),
            'user-agent': req.headers['user-agent'],
            'content-length': req.headers['content-length'],
          },
          res: {
            'content-length': res._headers['content-length'],
            statusCode: res.statusCode,
            'response-time': responseTime,
          },
          info: req.requestLogger._logInfo,
        },
        req.requestLogger._logMessage
      )
    }

    next()
  }
}

module.exports = RequestLogger
