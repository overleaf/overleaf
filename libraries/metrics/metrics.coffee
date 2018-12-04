traceAgent = require('@google-cloud/trace-agent')
debugAgent = require('@google-cloud/debug-agent')

prom = require('prom-client')
Register = require('prom-client').register
collectDefaultMetrics = prom.collectDefaultMetrics

appname = "unknown"
hostname = require('os').hostname()

buildKey = (key)-> "#{name}.#{hostname}.#{key}"
buildGlobalKey = (key)-> "#{name}.global.#{key}"



promMetrics = {}

destructors = []

require "./uv_threadpool_size"

module.exports = Metrics =
	initialize: (_name) ->
		appname = _name
		collectDefaultMetrics({ timeout: 5000, prefix: Metrics.buildPromKey()})
		traceAgent.start()
		debugAgent.start({
			serviceContext: {
				allowExpressions: true,
				service: appname,
				version: '0.0.1'
			}
		})
		Metrics.inc("process_startup")

	registerDestructor: (func) ->
		destructors.push func

	injectMetricsRoute: (app) ->
		app.get('/metrics', (req, res) -> 
			res.set('Content-Type', Register.contentType)
			res.end(Register.metrics())
		)

	buildPromKey: (key = "")->
		Metrics.sanitizeKey key

	sanitizeKey: (key) ->
		key.replace /[^a-zA-Z0-9]/g, "_"

	sanitizeValue: (value) ->
		parseFloat(value)

	set : (key, value, sampleRate = 1)->

	inc : (key, sampleRate = 1, opts = {})->
		key = Metrics.buildPromKey(key)
		if !promMetrics[key]?
			promMetrics[key] = new prom.Counter({
				name: key,
				help: key, 
				labelNames: ['app','host','status','method']
			})
		opts.app = appname
		opts.host = hostname
		promMetrics[key].inc(opts)

	count : (key, count, sampleRate = 1)->
		key = Metrics.buildPromKey(key)
		if !promMetrics[key]?
			promMetrics[key] = new prom.Counter({
				name: key,
				help: key, 
				labelNames: ['app','host']
			})
		promMetrics[key].inc({app: appname, host: hostname}, count)

	timing: (key, timeSpan, sampleRate, opts = {})->
		key = Metrics.sanitizeKey("timer_" + key)
		if !promMetrics[key]?
			promMetrics[key] = new prom.Summary({
				name: key,
				help: key,
				maxAgeSeconds: 600,
				ageBuckets: 10,
				labelNames: ['app', 'path', 'status_code', 'method', 'collection', 'query']
			})
		opts.app = appname
		promMetrics[key].observe(opts, timeSpan)

	Timer : class
		constructor :(key, sampleRate = 1, opts)->
			this.start = new Date()
			key = Metrics.sanitizeKey(key)
			this.key = key
			this.sampleRate = sampleRate
			this.opts = opts

		done:->
			timeSpan = new Date - this.start
			Metrics.timing(this.key, timeSpan, this.sampleRate, this.opts)
			return timeSpan

	gauge : (key, value, sampleRate = 1)->
		key = Metrics.buildPromKey(key)
		if !promMetrics[key]?
			promMetrics[key] = new prom.Gauge({
				name: key,
				help: key, 
				labelNames: ['app','host']
			})
		promMetrics[key].set({app: appname, host: hostname}, this.sanitizeValue(value))

	globalGauge: (key, value, sampleRate = 1)->
		key = Metrics.buildPromKey(key)
		if !promMetrics[key]?
			promMetrics[key] = new prom.Gauge({
				name: key,
				help: key, 
				labelNames: ['app','host']
			})
		promMetrics[key].set({app: appname},this.sanitizeValue(value))

	mongodb: require "./mongodb"
	http: require "./http"
	open_sockets: require "./open_sockets"
	event_loop: require "./event_loop"
	memory: require "./memory"

	timeAsyncMethod: require('./timeAsyncMethod')

	close: () ->
		for func in destructors
			func()
