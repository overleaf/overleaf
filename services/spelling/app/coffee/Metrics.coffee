StatsD = require('node-statsd').StatsD
statsd = new StatsD('localhost',8125)

buildKey = (key)-> "spelling.#{process.env.NODE_ENV}.#{key}"

module.exports =
	inc : (key, sampleRate)->
		statsd.increment buildKey(key, sampleRate)

	Timer : class
		constructor :(key)->
			this.start = new Date()
			this.key = buildKey(key)
		done:->
			timeSpan = new Date - this.start
			statsd.timing("#{this.key}-time", timeSpan)
			statsd.increment "#{this.key}-count"

	gauge : (key, value, sampleRate)->
		stats = {};
		stat = buildKey(key)
		stats[stat] = value+"|g";
		statsd.send(stats, sampleRate);
