StatsD = require('lynx')
statsd = new StatsD(process.env["STATSD_HOST"] or "localhost", 8125, {on_error:->})

prom = require('prom-client')
collectDefaultMetrics = client.collectDefaultMetrics

name = "unknown"
hostname = require('os').hostname()

buildKey = (key)-> "#{name}.#{hostname}.#{key}"
buildGlobalKey = (key)-> "#{name}.global.#{key}"

destructors = []

require "./uv_threadpool_size"

module.exports = Metrics =
	initialize: (_name) ->
		name = _name
		collectDefaultMetrics({ timeout: 5000, prefix: name })


	registerDestructor: (func) ->
		destructors.push func

	set : (key, value, sampleRate = 1)->
		statsd.set buildKey(key), value, sampleRate

	inc : (key, sampleRate = 1)->
		statsd.increment buildKey(key), sampleRate
		counter = new prom.Counter({
		  name: key,
		  help: key #https://prometheus.io/docs/instrumenting/writing_exporters/#help-strings this is probably wrong
		});
		counter.inc()

	count : (key, count, sampleRate = 1)->
		statsd.count buildKey(key), count, sampleRate
		counter = new prom.Counter({
		  name: key,
		  help: key #https://prometheus.io/docs/instrumenting/writing_exporters/#help-strings this is probably wrong
		});
		counter.inc(count)

	timing: (key, timeSpan, sampleRate)->
		statsd.timing(buildKey(key), timeSpan, sampleRate)

	Timer : class
		constructor :(key, sampleRate = 1)->
			this.start = new Date()
			this.key = key
			this.sampleRate = sampleRate
		done:->
			timeSpan = new Date - this.start
			statsd.timing(buildKey(this.key), timeSpan, this.sampleRate)
			return timeSpan

	gauge : (key, value, sampleRate = 1)->
		statsd.gauge buildKey(key), value, sampleRate

	globalGauge: (key, value, sampleRate = 1)->
		statsd.gauge buildGlobalKey(key), value, sampleRate

	mongodb: require "./mongodb"
	http: require "./http"
	open_sockets: require "./open_sockets"
	event_loop: require "./event_loop"
	memory: require "./memory"

	timeAsyncMethod: require('./timeAsyncMethod')

	close: () ->
		for func in destructors
			func()
		statsd.close()
