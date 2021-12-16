/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
module.exports = {
  monitor(logger, interval, logThreshold) {
    if (interval == null) {
      interval = 1000
    }
    if (logThreshold == null) {
      logThreshold = 100
    }
    const Metrics = require('./index')
    // check for logger on startup to avoid exceptions later if undefined
    if (logger == null) {
      throw new Error('logger is undefined')
    }
    // monitor delay in setInterval to detect event loop blocking
    let previous = Date.now()
    const intervalId = setInterval(function () {
      const now = Date.now()
      const offset = now - previous - interval
      if (offset > logThreshold) {
        logger.warn({ offset }, 'slow event loop')
      }
      previous = now
      return Metrics.timing('event-loop-millsec', offset)
    }, interval)

    return Metrics.registerDestructor(() => clearInterval(intervalId))
  },
}
