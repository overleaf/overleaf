const bunyan = require('bunyan')
const request = require('request')
const fs = require('fs')
const yn = require('yn')
const OError = require('@overleaf/o-error')
const GCPLogging = require('@google-cloud/logging-bunyan')

// bunyan error serializer
const errSerializer = function (err) {
  if (!err || !err.stack) {
    return err
  }
  return {
    message: err.message,
    name: err.name,
    stack: OError.getFullStack(err),
    info: OError.getFullInfo(err),
    code: err.code,
    signal: err.signal
  }
}

const Logger = (module.exports = {
  initialize(name) {
    this.isProduction =
      (process.env.NODE_ENV || '').toLowerCase() === 'production'
    this.defaultLevel =
      process.env.LOG_LEVEL || (this.isProduction ? 'warn' : 'debug')
    this.loggerName = name
    this.logger = bunyan.createLogger({
      name,
      serializers: {
        err: errSerializer,
        req: bunyan.stdSerializers.req,
        res: bunyan.stdSerializers.res
      },
      streams: [{ level: this.defaultLevel, stream: process.stdout }]
    })
    this._setupRingBuffer()
    this._setupStackdriver()
    this._setupLogLevelChecker()
    return this
  },

  checkLogLevelFile() {
    fs.readFile('/logging/tracingEndTime', (error, end) => {
      if (error || !end) {
        this.logger.level(this.defaultLevel)
        return
      }
      if (parseInt(end) > Date.now()) {
        this.logger.level('trace')
      } else {
        this.logger.level(this.defaultLevel)
      }
    })
  },

  checkLogLevelMetadata() {
    const options = {
      headers: {
        'Metadata-Flavor': 'Google'
      },
      uri: `http://metadata.google.internal/computeMetadata/v1/project/attributes/${this.loggerName}-setLogLevelEndTime`
    }
    request(options, (err, response, body) => {
      if (err) {
        this.logger.level(this.defaultLevel)
        return
      }
      if (parseInt(body) > Date.now()) {
        this.logger.level('trace')
      } else {
        this.logger.level(this.defaultLevel)
      }
    })
  },

  checkLogLevel() {
    fs.access('/logging', (err) => {
      if (err) {
        this.checkLogLevelMetadata()
      } else {
        this.checkLogLevelFile()
      }
    })
  },

  initializeErrorReporting(sentryDsn, options) {
    const raven = require('raven')
    this.raven = new raven.Client(sentryDsn, options)
    this.lastErrorTimeStamp = 0 // for rate limiting on sentry reporting
    this.lastErrorCount = 0
  },

  captureException(attributes, message, level) {
    // handle case of logger.error "message"
    let key, value
    if (typeof attributes === 'string') {
      attributes = { err: new Error(attributes) }
    }
    // extract any error object
    let error = attributes.err || attributes.error
    // avoid reporting errors twice
    for (key in attributes) {
      value = attributes[key]
      if (value instanceof Error && value.reportedToSentry) {
        return
      }
    }
    // include our log message in the error report
    if (error == null) {
      if (typeof message === 'string') {
        error = { message }
      }
    } else if (message != null) {
      attributes.description = message
    }
    // report the error
    if (error != null) {
      // capture attributes and use *_id objects as tags
      const tags = {}
      const extra = {}
      for (key in attributes) {
        value = attributes[key]
        if (key.match(/_id/) && typeof value === 'string') {
          tags[key] = value
        }
        extra[key] = value
      }
      // capture req object if available
      const { req } = attributes
      if (req != null) {
        extra.req = {
          method: req.method,
          url: req.originalUrl,
          query: req.query,
          headers: req.headers,
          ip: req.ip
        }
      }
      // recreate error objects that have been converted to a normal object
      if (!(error instanceof Error) && typeof error === 'object') {
        const newError = new Error(error.message)
        for (key of Object.keys(error || {})) {
          value = error[key]
          newError[key] = value
        }
        error = newError
      }
      // filter paths from the message to avoid duplicate errors in sentry
      // (e.g. errors from `fs` methods which have a path attribute)
      try {
        if (error.path) {
          error.message = error.message.replace(` '${error.path}'`, '')
        }

        // send the error to sentry
        this.raven.captureException(error, { tags, extra, level })

        // put a flag on the errors to avoid reporting them multiple times
        for (key in attributes) {
          value = attributes[key]
          if (value instanceof Error) {
            value.reportedToSentry = true
          }
        }
      } catch (err) {
        // ignore Raven errors
      }
    }
  },

  debug() {
    return this.logger.debug.apply(this.logger, arguments)
  },

  info() {
    return this.logger.info.apply(this.logger, arguments)
  },

  log() {
    return this.logger.info.apply(this.logger, arguments)
  },

  error(attributes, message, ...args) {
    if (this.ringBuffer !== null && Array.isArray(this.ringBuffer.records)) {
      attributes.logBuffer = this.ringBuffer.records.filter(function (record) {
        return record.level !== 50
      })
    }
    this.logger.error(attributes, message, ...Array.from(args))
    if (this.raven != null) {
      const MAX_ERRORS = 5 // maximum number of errors in 1 minute
      const now = new Date()
      // have we recently reported an error?
      const recentSentryReport = now - this.lastErrorTimeStamp < 60 * 1000
      // if so, increment the error count
      if (recentSentryReport) {
        this.lastErrorCount++
      } else {
        this.lastErrorCount = 0
        this.lastErrorTimeStamp = now
      }
      // only report 5 errors every minute to avoid overload
      if (this.lastErrorCount < MAX_ERRORS) {
        // add a note if the rate limit has been hit
        const note =
          this.lastErrorCount + 1 === MAX_ERRORS ? '(rate limited)' : ''
        // report the exception
        return this.captureException(attributes, message, `error${note}`)
      }
    }
  },

  err() {
    return this.error.apply(this, arguments)
  },

  warn() {
    return this.logger.warn.apply(this.logger, arguments)
  },

  fatal(attributes, message, callback) {
    if (callback == null) {
      callback = function () {}
    }
    this.logger.fatal(attributes, message)
    if (this.raven != null) {
      var cb = function (e) {
        // call the callback once after 'logged' or 'error' event
        callback()
        return (cb = function () {})
      }
      this.captureException(attributes, message, 'fatal')
      this.raven.once('logged', cb)
      return this.raven.once('error', cb)
    } else {
      return callback()
    }
  },

  _setupRingBuffer() {
    this.ringBufferSize = parseInt(process.env.LOG_RING_BUFFER_SIZE) || 0
    if (this.ringBufferSize > 0) {
      this.ringBuffer = new bunyan.RingBuffer({ limit: this.ringBufferSize })
      this.logger.addStream({
        level: 'trace',
        type: 'raw',
        stream: this.ringBuffer
      })
    } else {
      this.ringBuffer = null
    }
  },

  _setupStackdriver() {
    const stackdriverEnabled = yn(process.env.STACKDRIVER_LOGGING)
    if (!stackdriverEnabled) {
      return
    }
    const stackdriverClient = new GCPLogging.LoggingBunyan({
      logName: this.loggerName,
      serviceContext: { service: this.loggerName }
    })
    this.logger.addStream(stackdriverClient.stream(this.defaultLevel))
  },

  _setupLogLevelChecker() {
    if (this.isProduction) {
      // clear interval if already set
      if (this.checkInterval) {
        clearInterval(this.checkInterval)
      }
      // check for log level override on startup
      this.checkLogLevel()
      // re-check log level every minute
      this.checkInterval = setInterval(this.checkLogLevel.bind(this), 1000 * 60)
    }
  }
})

Logger.initialize('default-sharelatex')
