seconds = 1000

module.exports = EventLoopMonitor =
	monitor: (logger) ->
		interval = setInterval () ->
			EventLoopMonitor.Delay()
		, 1 * seconds
		Metrics = require "./metrics"
		Metrics.registerDestructor () ->
			clearInterval(interval)

	Delay: () ->
		Metrics = require "./metrics"
		t1 = process.hrtime()
		setImmediate () ->
			delta = process.hrtime(t1)
			responseTime = delta[0]*1e6 + delta[1]*1e-3
			Metrics.timing("event-loop-microsec", responseTime)
