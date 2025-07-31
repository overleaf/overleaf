const Stream = require('node:stream')
const bunyan = require('bunyan')
const GCPManager = require('./gcp-manager')
const Serializers = require('./serializers')
const {
  FileLogLevelChecker,
  GCEMetadataLogLevelChecker,
} = require('./log-level-checker')

const LoggingManager = {
  /**
   * @param {string} name - The name of the logger
   */
  initialize(name, options = {}) {
    this.isProduction =
      (process.env.NODE_ENV || '').toLowerCase() === 'production'
    const isTest = (process.env.NODE_ENV || '').toLowerCase() === 'test'
    this.defaultLevel =
      process.env.LOG_LEVEL ||
      (this.isProduction ? 'info' : isTest ? 'fatal' : 'debug')
    this.loggerName = name
    this.logger = bunyan.createLogger({
      name,
      serializers: {
        err: Serializers.err,
        error: Serializers.err,
        req: Serializers.req,
        res: Serializers.res,
      },
      streams: options.streams ?? [this._getOutputStreamConfig()],
    })
    this._setupRingBuffer()
    this._setupLogLevelChecker()
    return this
  },

  /**
   * @param {Record<string, any>|string} attributes - Attributes to log (nice serialization for err, req, res)
   * @param {string} [message] - Optional message
   * @signature `debug(attributes, message)`
   * @signature `debug(message)`
   */
  debug(attributes, message, ...args) {
    return this.logger.debug(attributes, message, ...args)
  },

  /**
   * @param {Record<string, any>|string} attributes - Attributes to log (nice serialization for err, req, res)
   * @param {string} [message]
   * @signature `info(attributes, message)`
   * @signature `info(message)`
   */
  info(attributes, message, ...args) {
    return this.logger.info(attributes, message, ...args)
  },

  /**
   * @param {Record<string, any>} attributes - Attributes to log (nice serialization for err, req, res)
   * @param {string} [message]
   */
  error(attributes, message, ...args) {
    if (this.ringBuffer !== null && Array.isArray(this.ringBuffer.records)) {
      attributes.logBuffer = this.ringBuffer.records.filter(function (record) {
        return record.level !== 50
      })
    }
    this.logger.error(attributes, message, ...Array.from(args))
  },

  /**
   * Alias to the error method.
   * @param {Record<string, any>} attributes - Attributes to log (nice serialization for err, req, res)
   * @param {string} [message]
   */
  err(attributes, message, ...args) {
    return this.error(attributes, message, ...args)
  },

  /**
   * @param {Record<string, any>|string} attributes - Attributes to log (nice serialization for err, req, res)
   * @param {string} [message]
   * @signature `warn(attributes, message)`
   * @signature `warn(message)`
   */
  warn(attributes, message, ...args) {
    return this.logger.warn(attributes, message, ...args)
  },

  /**
   * @param {Record<string, any>} attributes - Attributes to log (nice serialization for err, req, res)
   * @param {string} [message]
   */
  fatal(attributes, message) {
    this.logger.fatal(attributes, message)
  },

  _getOutputStreamConfig() {
    switch (process.env.LOGGING_FORMAT) {
      case 'gke': {
        const stream = new Stream.Writable({
          objectMode: true,
          write(entry, encoding, callback) {
            const gcpEntry = GCPManager.convertLogEntry(entry)
            // eslint-disable-next-line no-console
            console.log(JSON.stringify(gcpEntry, bunyan.safeCycles()))
            setImmediate(callback)
          },
        })
        return { level: this.defaultLevel, type: 'raw', stream }
      }
      case 'gce': {
        const { LoggingBunyan } = require('@google-cloud/logging-bunyan')
        return new LoggingBunyan({
          logName: this.loggerName,
          serviceContext: { service: this.loggerName },
        }).stream(this.defaultLevel)
      }
      default: {
        return { level: this.defaultLevel, stream: process.stdout }
      }
    }
  },

  _setupRingBuffer() {
    this.ringBufferSize = parseInt(process.env.LOG_RING_BUFFER_SIZE) || 0
    if (this.ringBufferSize > 0) {
      this.ringBuffer = new bunyan.RingBuffer({ limit: this.ringBufferSize })
      this.logger.addStream({
        level: 'trace',
        type: 'raw',
        stream: this.ringBuffer,
      })
    } else {
      this.ringBuffer = null
    }
  },

  _setupLogLevelChecker() {
    const logLevelSource = (
      process.env.LOG_LEVEL_SOURCE || 'file'
    ).toLowerCase()

    if (this.logLevelChecker) {
      this.logLevelChecker.stop()
      this.logLevelChecker = null
    }

    if (this.isProduction) {
      switch (logLevelSource) {
        case 'file':
          this.logLevelChecker = new FileLogLevelChecker(
            this.logger,
            this.defaultLevel
          )
          break
        case 'gce_metadata':
          this.logLevelChecker = new GCEMetadataLogLevelChecker(
            this.logger,
            this.defaultLevel
          )
          break
        case 'none':
          break
        default:
          // eslint-disable-next-line no-console
          console.log(`Unrecognised log level source: ${logLevelSource}`)
      }
      if (this.logLevelChecker) {
        this.logLevelChecker.start()
      }
    }
  },
}

LoggingManager.initialize('default')

function handleWarning(err) {
  LoggingManager.warn({ err }, 'Warning details')
}

process.on('warning', handleWarning)
LoggingManager.removeWarningHandler = () => {
  process.off('warning', handleWarning)
}

module.exports = LoggingManager
