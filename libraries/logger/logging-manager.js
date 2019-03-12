const bunyan = require('bunyan')
const request = require('request')

const Logger = module.exports = {
  initialize(name) {
    this.isProduction =
      (process.env['NODE_ENV'] || '').toLowerCase() === 'production'
    this.defaultLevel =
      process.env['LOG_LEVEL'] || (this.isProduction ? 'warn' : 'debug')
    this.loggerName = name
    this.ringBufferSize = parseInt(process.env['LOG_RING_BUFFER_SIZE']) || 0
    const loggerStreams = [
      {
        level: this.defaultLevel,
        stream: process.stdout
      }
    ]
    if (this.ringBufferSize > 0) {
      this.ringBuffer = new bunyan.RingBuffer({limit: this.ringBufferSize})
      loggerStreams.push({
        level: 'trace',
        type: 'raw',
        stream: this.ringBuffer
      })
    }
    else {
      this.ringBuffer = null
    }
    this.logger = bunyan.createLogger({
      name,
      serializers: bunyan.stdSerializers,
      streams: loggerStreams
    })
    if (this.isProduction) {
      // clear interval if already set
      if (this.checkInterval) {
        clearInterval(this.checkInterval)
      }
      // check for log level override on startup
      this.checkLogLevel()
      // re-check log level every minute
      const checkLogLevel = () => this.checkLogLevel()
      this.checkInterval = setInterval(checkLogLevel, 1000 * 60)
    }
    return this
  },

  checkLogLevel() {
    const options = {
      headers: {
        'Metadata-Flavor': 'Google'
      },
      uri: `http://metadata.google.internal/computeMetadata/v1/project/attributes/${
        this.loggerName
      }-setLogLevelEndTime`
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

  initializeErrorReporting(sentry_dsn, options) {
    const raven = require('raven')
    this.raven = new raven.Client(sentry_dsn, options)
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
      } catch (error1) {}
      // send the error to sentry
      try {
        this.raven.captureException(error, { tags, extra, level })
        // put a flag on the errors to avoid reporting them multiple times
        return (() => {
          const result = []
          for (key in attributes) {
            value = attributes[key]
            if (value instanceof Error) {
              result.push((value.reportedToSentry = true))
            } else {
              result.push(undefined)
            }
          }
          return result
        })()
      } catch (error2) {
        return
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
      callback = function() {}
    }
    this.logger.fatal(attributes, message)
    if (this.raven != null) {
      var cb = function(e) {
        // call the callback once after 'logged' or 'error' event
        callback()
        return (cb = function() {})
      }
      this.captureException(attributes, message, 'fatal')
      this.raven.once('logged', cb)
      return this.raven.once('error', cb)
    } else {
      return callback()
    }
  }
}

Logger.initialize('default-sharelatex')
