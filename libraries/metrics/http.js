const yn = require('yn')

const STACKDRIVER_LOGGING = yn(process.env.STACKDRIVER_LOGGING)

module.exports.monitor = logger =>
  function(req, res, next) {
    const Metrics = require('./index')
    const startTime = process.hrtime()
    const { end } = res
    res.end = function() {
      end.apply(this, arguments)
      const responseTime = process.hrtime(startTime)
      const responseTimeMs = Math.round(
        responseTime[0] * 1000 + responseTime[1] / 1000000
      )
      const requestSize = parseInt(req.headers['content-length'], 10)
      if (req.route && req.route.path != null) {
        const routePath = req.route.path
          .toString()
          .replace(/\//g, '_')
          .replace(/:/g, '')
          .slice(1)
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
      const remoteIp =
        req.ip ||
        (req.socket && req.socket.socket && req.socket.socket.remoteAddress) ||
        (req.socket && req.socket.remoteAddress)
      const reqUrl = req.originalUrl || req.url
      const referrer = req.headers.referer || req.headers.referrer

      let info
      if (STACKDRIVER_LOGGING) {
        info = {
          httpRequest: {
            requestMethod: req.method,
            requestUrl: reqUrl,
            requestSize,
            status: res.statusCode,
            responseSize: res.getHeader('content-length'),
            userAgent: req.headers['user-agent'],
            remoteIp,
            referer: referrer,
            latency: {
              seconds: responseTime[0],
              nanos: responseTime[1]
            },
            protocol: req.protocol
          }
        }
      } else {
        info = {
          req: {
            url: reqUrl,
            method: req.method,
            referrer,
            'remote-addr': remoteIp,
            'user-agent': req.headers['user-agent'],
            'content-length': req.headers['content-length']
          },
          res: {
            'content-length': res.getHeader('content-length'),
            statusCode: res.statusCode
          },
          'response-time': responseTimeMs
        }
      }
      logger.info(info, '%s %s', req.method, reqUrl)
    }
    next()
  }
