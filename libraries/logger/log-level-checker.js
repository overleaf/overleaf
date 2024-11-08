const { fetchString } = require('@overleaf/fetch-utils')
const fs = require('node:fs')

class LogLevelChecker {
  constructor(logger, defaultLevel) {
    this.logger = logger
    this.defaultLevel = defaultLevel
  }

  start() {
    // check for log level override on startup
    this.checkLogLevel()
    // re-check log level every minute
    this.checkInterval = setInterval(this.checkLogLevel.bind(this), 1000 * 60)
    this.checkInterval.unref()
  }

  stop() {
    clearInterval(this.checkInterval)
  }

  async checkLogLevel() {
    try {
      const end = await this.getTracingEndTime()
      if (end > Date.now()) {
        this.logger.level('trace')
      } else {
        this.logger.level(this.defaultLevel)
      }
    } catch (e) {
      this.logger.level(this.defaultLevel)
    }
  }

  async getTracingEndTime() {
    return 0
  }
}

class FileLogLevelChecker extends LogLevelChecker {
  async getTracingEndTime() {
    const strEndTime = await fs.promises.readFile('/logging/tracingEndTime')
    return parseInt(strEndTime, 10)
  }
}

class GCEMetadataLogLevelChecker extends LogLevelChecker {
  async getTracingEndTime() {
    const options = {
      headers: {
        'Metadata-Flavor': 'Google',
      },
    }
    const uri = `http://metadata.google.internal/computeMetadata/v1/project/attributes/${this.logger.fields.name}-setLogLevelEndTime`
    const strEndTime = await fetchString(uri, options)
    return parseInt(strEndTime, 10)
  }
}

module.exports = { FileLogLevelChecker, GCEMetadataLogLevelChecker }
