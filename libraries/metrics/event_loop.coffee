module.exports = EventLoopMonitor =
	monitor: (logger, interval = 1000, log_threshold = 100) ->
		Metrics = require "./metrics"
		
		previous = Date.now()
		intervalId = setInterval () ->
			now = Date.now()
			offset = now - previous - interval
			if offset > log_threshold
				logger.warn {offset: offset}, "slow event loop"
			previous = now
			Metrics.timing("event-loop-millsec", offset)
		, interval
		
		Metrics.registerDestructor () ->
			clearInterval(intervalId)
