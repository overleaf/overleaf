const Metrics = require('metrics-sharelatex')
const logger = require('logger-sharelatex')

// TODO: domain has been deprecated for some time - do we need it and is there a better way?

// eslint-disable-next-line node/no-deprecated-api
const domain = require('domain')

const TWO_MINUTES = 120 * 1000

class ExceptionHandler {
  constructor() {
    this._appIsOk = true
  }

  beginShutdown() {
    if (this._appIsOk) {
      this._appIsOk = false

      // hard-terminate this process if graceful shutdown fails
      const killTimer = setTimeout(() => process.exit(1), TWO_MINUTES)

      if (typeof killTimer.unref === 'function') {
        killTimer.unref()
      } // prevent timer from keeping process alive

      this.server.close(function() {
        logger.log('closed all connections')
        Metrics.close()
        if (typeof process.disconnect === 'function') {
          process.disconnect()
        }
      })
      logger.log('server will stop accepting connections')
    }
  }

  addMiddleware(app) {
    app.use(this.middleware.bind(this))
  }

  appIsOk() {
    return this._appIsOk
  }

  setNotOk() {
    this._appIsOk = false
  }

  middleware(req, res, next) {
    const rescueLogger = require('logger-sharelatex')
    const requestDomain = domain.create()
    requestDomain.add(req)
    requestDomain.add(res)
    requestDomain.on('error', err => {
      try {
        // request a shutdown to prevent memory leaks
        this.beginShutdown()
        if (!res.headerSent) {
          res.status(500).send('uncaught exception')
        }
        req = {
          body: req.body,
          headers: req.headers,
          url: req.url,
          key: req.key,
          statusCode: req.statusCode
        }
        err = {
          message: err.message,
          stack: err.stack,
          name: err.name,
          type: err.type,
          arguments: err.arguments
        }
        rescueLogger.err(
          { err, req, res },
          'uncaught exception thrown on request'
        )
      } catch (exception) {
        rescueLogger.err(
          { err: exception },
          'exception in request domain handler'
        )
      }
    })

    if (!this._appIsOk) {
      // when shutting down, close any HTTP keep-alive connections
      res.set('Connection', 'close')
    }

    requestDomain.run(next)
  }
}

module.exports = ExceptionHandler
