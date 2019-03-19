logger = require 'logger-sharelatex'

# keep track of message counters to detect duplicate and out of order events
# messsage ids have the format "UNIQUEHOSTKEY-COUNTER"

EVENT_LOG_COUNTER = {}
EVENT_LOG_TIMESTAMP = {}
EVENT_COUNT = 0

module.exports = EventLogger =

	MAX_EVENTS_BEFORE_CLEAN: 100000
	MAX_STALE_TIME_IN_MS: 3600 * 1000

	checkEventOrder: (message_id, message) ->
		return if typeof(message_id) isnt 'string'
		[key, count] = message_id.split("-", 2)
		count = parseInt(count, 10)
		if !count # ignore checks if counter is not present
			return
		# store the last count in a hash for each host
		previous = EventLogger._storeEventCount(key, count)
		if !previous? || count == (previous + 1)
			return # order is ok
		if (count == previous)
			logger.error {key:key, previous: previous, count:count, message:message}, "duplicate event"
			return "duplicate"
		else
			logger.error {key:key, previous: previous, count:count, message:message}, "events out of order"
			return # out of order

	_storeEventCount: (key, count) ->
		previous = EVENT_LOG_COUNTER[key]
		now = Date.now()
		EVENT_LOG_COUNTER[key] = count
		EVENT_LOG_TIMESTAMP[key] = now
		# periodically remove old counts
		if (++EVENT_COUNT % EventLogger.MAX_EVENTS_BEFORE_CLEAN) == 0
			EventLogger._cleanEventStream(now)
		return previous

	_cleanEventStream: (now) ->
		for key, timestamp of EVENT_LOG_TIMESTAMP
			if (now - timestamp) > EventLogger.MAX_STALE_TIME_IN_MS
				delete EVENT_LOG_COUNTER[key]
				delete EVENT_LOG_TIMESTAMP[key]