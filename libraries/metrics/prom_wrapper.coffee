prom = require('prom-client')
registry = require('prom-client').register
metrics = new Map()


optsKey = (opts) ->
	keys = Object.keys(opts)
	return '' if keys.length == 0

	keys = keys.sort()

	hash = '';
	for key in keys
		hash += "," if hash.length
		hash += "#{key}:#{opts[key]}"

	return hash

extendOpts = (opts, labelNames) ->
	for label in labelNames
		opts[label] ||= ''
	return opts

optsAsArgs = (opts, labelNames) ->
	args = []
	for label in labelNames
		args.push(opts[label] || '')
	return args


PromWrapper =
	ttlInMinutes: 0
	registry: registry

	metric: (type, name) ->
		metrics.get(name) || new MetricWrapper(type, name)

	collectDefaultMetrics: prom.collectDefaultMetrics


class MetricWrapper
	constructor: (type, name) ->
		metrics.set(name, this)
		@name = name
		@instances = new Map()
		@lastAccess = new Date()
		@metric = switch type
			when "counter"
				new prom.Counter({
					name: name,
					help: name,
					labelNames: ['app','host','status','method', 'path']
				})
			when "summary"
				new prom.Summary({
					name: name,
					help: name,
					maxAgeSeconds: 600,
					ageBuckets: 10,
					labelNames: ['app', 'host', 'path', 'status_code', 'method', 'collection', 'query']
				})
			when "gauge"
				prom.Gauge({
					name: name,
					help: name,
					labelNames: ['app','host', 'status']
				})

	inc: (opts, value) ->
		@_execMethod 'inc', opts, value

	observe: (opts, value) ->
		@_execMethod 'observe', opts, value

	set: (opts, value) ->
		@_execMethod 'set', opts, value

	sweep: () ->
		thresh = new Date(Date.now() - 1000 * 60 * PromWrapper.ttlInMinutes)
		@instances.forEach (instance, key) =>
			if thresh > instance.time
				if process.env['DEBUG_METRICS']
					console.log("Sweeping stale metric instance", @name, opts: instance.opts, key)
				@metric.remove(optsAsArgs(instance.opts, @metric.labelNames)...)

		if thresh > @lastAccess
			if process.env['DEBUG_METRICS']
				console.log("Sweeping stale metric", @name, thresh, @lastAccess)
			metrics.delete(@name)
			registry.removeSingleMetric(@name)

	_execMethod: (method, opts, value) ->
		opts = extendOpts(opts, @metric.labelNames)
		key = optsKey(opts)
		@instances.set(key, { time: new Date(), opts }) unless key == ''
		@lastAccess = new Date()
		@metric[method](opts, value)


unless PromWrapper.sweepRegistered
	if process.env['DEBUG_METRICS']
		console.log("Registering sweep method")
	PromWrapper.sweepRegistered = true
	setInterval(
		() ->
			if PromWrapper.ttlInMinutes
				if process.env['DEBUG_METRICS']
					console.log("Sweeping metrics")
				metrics.forEach (metric, key) =>
					metric.sweep()
	60000)


module.exports = PromWrapper
