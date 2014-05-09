StatsD = require('lynx')
statsd = new StatsD('localhost', 8125, {on_error:->})

name = "unknown"
hostname = require('os').hostname()

buildKey = (key)-> "#{name}.#{hostname}.#{key}"

module.exports =
	initialize: (_name) ->
		name = _name

	set : (key, value, sampleRate = 1)->
		statsd.set buildKey(key), value, sampleRate

	inc : (key, sampleRate = 1)->
		statsd.increment buildKey(key), sampleRate

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

	gauge : (key, value, sampleRate = 1)->
		statsd.gauge key, value, sampleRate

	mongodb: require "./mongodb"
	http: require "./http"
	open_sockets: require "./open_sockets"

