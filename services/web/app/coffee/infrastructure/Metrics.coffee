StatsD = require('lynx')
settings = require('settings-sharelatex')
statsd = new StatsD('localhost', 8125, {on_error:->})

buildKey = (key)-> "web.#{process.env.NODE_ENV}.#{key}"

module.exports =
	set : (key, value, sampleRate = 1)->
		statsd.set buildKey(key), value, sampleRate

	inc : (key, sampleRate = 1)->
		statsd.increment buildKey(key), sampleRate

	timing: (key, timeSpan, sampleRate)->
		statsd.timing(key, timeSpan, sampleRate)

	Timer : class
		constructor :(key, sampleRate = 1)->
			this.start = new Date()
			this.key = buildKey(key)
		done:->
			timeSpan = new Date - this.start
			statsd.timing(this.key, timeSpan, this.sampleRate)

	gauge : (key, value, sampleRate = 1)->
		statsd.gauge key, value, sampleRate

