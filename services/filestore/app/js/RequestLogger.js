import logger from '@overleaf/logger'
import metrics from '@overleaf/metrics'

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

      const level = res.statusCode >= 500 ? 'err' : 'debug'
      logger[level](
        {
          req,
          res,
          responseTimeMs: responseTime,
          info: req.requestLogger._logInfo,
        },
        req.requestLogger._logMessage
      )
    }

    next()
  }
}

export default RequestLogger
