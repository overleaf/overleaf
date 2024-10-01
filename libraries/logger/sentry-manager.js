const Serializers = require('./serializers')
const RATE_LIMIT_MAX_ERRORS = 5
const RATE_LIMIT_INTERVAL_MS = 60000

class SentryManager {
  constructor(dsn, options) {
    this.Sentry = require('@sentry/node')
    this.Sentry.init({ dsn, ...options })
    // for rate limiting on sentry reporting
    this.lastErrorTimeStamp = 0
    this.lastErrorCount = 0
  }

  captureExceptionRateLimited(attributes, message) {
    const now = Date.now()
    // have we recently reported an error?
    const recentSentryReport =
      now - this.lastErrorTimeStamp < RATE_LIMIT_INTERVAL_MS
    // if so, increment the error count
    if (recentSentryReport) {
      this.lastErrorCount++
    } else {
      this.lastErrorCount = 0
      this.lastErrorTimeStamp = now
    }
    // only report 5 errors every minute to avoid overload
    if (this.lastErrorCount < RATE_LIMIT_MAX_ERRORS) {
      // add a note if the rate limit has been hit
      const note =
        this.lastErrorCount + 1 === RATE_LIMIT_MAX_ERRORS
          ? '(rate limited)'
          : ''
      // report the exception
      this.captureException(attributes, message, `error${note}`)
    }
  }

  captureException(attributes, message, level) {
    // handle case of logger.error "message"
    if (typeof attributes === 'string') {
      attributes = { err: new Error(attributes) }
    }

    // extract any error object
    let error = Serializers.err(attributes.err || attributes.error)

    // avoid reporting errors twice
    for (const key in attributes) {
      const value = attributes[key]
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
      for (const key in attributes) {
        let value = attributes[key]
        if (Serializers[key]) {
          value = Serializers[key](value)
        }
        if (key.match(/_id/) && typeof value === 'string') {
          tags[key] = value
        }
        extra[key] = value
      }

      // OError integration
      extra.info = error.info
      delete error.info

      // Sentry wants to receive an Error instance.
      const errInstance = new Error(error.message)
      Object.assign(errInstance, error)

      try {
        // send the error to sentry
        this.Sentry.captureException(errInstance, { tags, extra, level })

        // put a flag on the errors to avoid reporting them multiple times
        for (const key in attributes) {
          const value = attributes[key]
          if (value instanceof Error) {
            value.reportedToSentry = true
          }
        }
      } catch (err) {
        // ignore Sentry errors
      }
    }
  }
}

module.exports = SentryManager
