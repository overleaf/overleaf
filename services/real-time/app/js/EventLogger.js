import logger from '@overleaf/logger'
import metrics from '@overleaf/metrics'
import settings from '@overleaf/settings'
let EventLogger

// keep track of message counters to detect duplicate and out of order events
// messsage ids have the format "UNIQUEHOSTKEY-COUNTER"

const EVENT_LOG_COUNTER = {}
const EVENT_LOG_TIMESTAMP = {}
let EVENT_LAST_CLEAN_TIMESTAMP = 0

// counter for debug logs
let COUNTER = 0

export default EventLogger = {
  MAX_STALE_TIME_IN_MS: 3600 * 1000,

  debugEvent(channel, message) {
    if (settings.debugEvents > 0) {
      logger.info({ channel, message, counter: COUNTER++ }, 'logging event')
      settings.debugEvents--
    }
  },

  checkEventOrder(channel, messageId) {
    if (typeof messageId !== 'string') {
      return
    }
    let result
    if (!(result = messageId.match(/^(.*)-(\d+)$/))) {
      return
    }
    const key = result[1]
    const count = parseInt(result[2], 0)
    if (!(count >= 0)) {
      // ignore checks if counter is not present
      return
    }
    // store the last count in a hash for each host
    const previous = EventLogger._storeEventCount(key, count)
    if (!previous || count === previous + 1) {
      metrics.inc(`event.${channel}.valid`)
      return // order is ok
    }
    if (count === previous) {
      metrics.inc(`event.${channel}.duplicate`)
      logger.warn({ channel, messageId }, 'duplicate event')
      return 'duplicate'
    } else {
      metrics.inc(`event.${channel}.out-of-order`)
      logger.warn(
        { channel, messageId, key, previous, count },
        'out of order event'
      )
      return 'out-of-order'
    }
  },

  _storeEventCount(key, count) {
    const previous = EVENT_LOG_COUNTER[key]
    const now = Date.now()
    EVENT_LOG_COUNTER[key] = count
    EVENT_LOG_TIMESTAMP[key] = now
    // periodically remove old counts
    if (now - EVENT_LAST_CLEAN_TIMESTAMP > EventLogger.MAX_STALE_TIME_IN_MS) {
      EventLogger._cleanEventStream(now)
      EVENT_LAST_CLEAN_TIMESTAMP = now
    }
    return previous
  },

  _cleanEventStream(now) {
    Object.entries(EVENT_LOG_TIMESTAMP).forEach(([key, timestamp]) => {
      if (now - timestamp > EventLogger.MAX_STALE_TIME_IN_MS) {
        delete EVENT_LOG_COUNTER[key]
        delete EVENT_LOG_TIMESTAMP[key]
      }
    })
  },
}
