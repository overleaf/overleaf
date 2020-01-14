const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')

class RequestLogger {
  constructor() {
    this.errorHandler = this.errorHandler.bind(this)
    this.middleware = this.middleware.bind(this)
    this._logInfo = {}
    this._logMessage = 'http request'
  }

  attach(app) {
    app.use(this.middleware)
    app.use(this.errorHandler)
  }

  errorHandler(err, req, res, next) {
    this._logInfo.error = err
    res
      .send(err.message)
      .status(500)
      .end()
  }

  addFields(fields) {
    Object.assign(this._logInfo, fields)
  }

  setMessage(message) {
    this._logMessage = message
  }

  middleware(req, res, next) {
    const startTime = new Date()
    req.requestLogger = this

    // override the 'end' method to log and record metrics
    const end = res.end
    res.end = function() {
      // apply the standard request 'end' method before logging and metrics
      end.apply(this, arguments)

      const responseTime = new Date() - startTime

      const routePath = req.route && req.route.path.toString()

      if (routePath) {
        metrics.timing('http_request', responseTime, null, {
          method: req.method,
          status_code: res.statusCode,
          path: routePath
            .replace(/\//g, '_')
            .replace(/:/g, '')
            .slice(1)
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
            'content-length': req.headers['content-length']
          },
          res: {
            'content-length': res._headers['content-length'],
            statusCode: res.statusCode,
            'response-time': responseTime
          },
          info: this._logInfo
        },
        this._logMessage
      )
    }

    next()
  }
}

module.exports = RequestLogger
