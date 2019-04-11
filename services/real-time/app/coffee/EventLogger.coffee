logger = require 'logger-sharelatex'
metrics = require 'metrics-sharelatex'
settings = require 'settings-sharelatex'

# keep track of message counters to detect duplicate and out of order events
# messsage ids have the format "UNIQUEHOSTKEY-COUNTER"

EVENT_LOG_COUNTER = {}
EVENT_LOG_TIMESTAMP = {}
EVENT_LAST_CLEAN_TIMESTAMP = 0

# counter for debug logs
COUNTER = 0

module.exports = EventLogger =

	MAX_STALE_TIME_IN_MS: 3600 * 1000

	debugEvent: (channel, message) ->
		if settings.debugEvents > 0
			logger.log {channel:channel, message:message, counter: COUNTER++}, "logging event"
			settings.debugEvents--

	checkEventOrder: (channel, message_id, message) ->
		return if typeof(message_id) isnt 'string'
		return if !(result = message_id.match(/^(.*)-(\d+)$/))
		key = result[1]
		count = parseInt(result[2], 0)
		if !(count >= 0)# ignore checks if counter is not present
			return
		# store the last count in a hash for each host
		previous = EventLogger._storeEventCount(key, count)
		if !previous? || count == (previous + 1)
			metrics.inc "event.#{channel}.valid", 0.001 # downsample high rate docupdater events
			return # order is ok
		if (count == previous)
			metrics.inc "event.#{channel}.duplicate"
			logger.warn {channel:channel, message_id:message_id}, "duplicate event"
			return "duplicate"
		else
			metrics.inc "event.#{channel}.out-of-order"
			logger.warn {channel:channel, message_id:message_id, key:key, previous: previous, count:count}, "out of order event"
			return "out-of-order"

	_storeEventCount: (key, count) ->
		previous = EVENT_LOG_COUNTER[key]
		now = Date.now()
		EVENT_LOG_COUNTER[key] = count
		EVENT_LOG_TIMESTAMP[key] = now
		# periodically remove old counts
		if (now - EVENT_LAST_CLEAN_TIMESTAMP) > EventLogger.MAX_STALE_TIME_IN_MS
			EventLogger._cleanEventStream(now)
			EVENT_LAST_CLEAN_TIMESTAMP = now
		return previous

	_cleanEventStream: (now) ->
		for key, timestamp of EVENT_LOG_TIMESTAMP
			if (now - timestamp) > EventLogger.MAX_STALE_TIME_IN_MS
				delete EVENT_LOG_COUNTER[key]
				delete EVENT_LOG_TIMESTAMP[key]