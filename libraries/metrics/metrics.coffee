debugAgent = require('@google-cloud/debug-agent')
traceAgent = require('@google-cloud/trace-agent')

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
		if process.env['ENABLE_TRACE_AGENT'] == "true"
			traceOpts =
				ignoreUrls: [/^\/status/, /^\/health_check/] 
			traceAgent.start(traceOpts)
		debugAgent.start({
			serviceContext: {
				allowExpressions: true,
				service: appname,
				version: process.env['BUILD_VERSION']
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
		key.replace /[^a-zA-Z0-9]/g, "_"

	sanitizeValue: (value) ->
		parseFloat(value)

	set : (key, value, sampleRate = 1)->
		console.log("counts are not currently supported")

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
		if process.env['DEBUG_METRICS']
			console.log("doing inc", key, opts)

	count : (key, count, sampleRate = 1)->
		key = Metrics.buildPromKey(key)
		if !promMetrics[key]?
			promMetrics[key] = new prom.Counter({
				name: key,
				help: key, 
				labelNames: ['app','host']
			})
		promMetrics[key].inc({app: appname, host: hostname}, count)
		if process.env['DEBUG_METRICS']
			console.log("doing count/inc", key, opts)

	timing: (key, timeSpan, sampleRate, opts = {})->
		key = Metrics.buildPromKey("timer_" + key)
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
		if process.env['DEBUG_METRICS']
			console.log("doing timing", key, opts)

	Timer : class
		constructor :(key, sampleRate = 1, opts)->
			this.start = new Date()
			key = Metrics.buildPromKey(key)
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
		if process.env['DEBUG_METRICS']
			console.log("doing gauge", key, opts)
			
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
