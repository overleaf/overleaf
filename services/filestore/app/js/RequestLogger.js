const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')

module.exports = {
  errorHandler,
  middleware
}

function errorHandler(err, req, res, next) {
  req._logInfo.set('error', err)
  res
    .send(err.message)
    .status(500)
    .end()
}

function middleware(req, res, next) {
  const startTime = new Date()

  // methods to allow the setting of additional information to be logged for the request
  req._logInfo = {}
  req._logMessage = 'http request'
  req.addLogField = function(field, value) {
    req._logInfo[field] = value
  }
  req.addLogFields = function(fields) {
    Object.assign(req._logInfo, fields)
  }
  req.setLogMessage = function(message) {
    req._logMessage = message
  }

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
        info: req._logInfo
      },
      req._logMessage
    )
  }

  next()
}
