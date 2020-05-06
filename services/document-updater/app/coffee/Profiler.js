Settings = require('settings-sharelatex')
logger = require('logger-sharelatex')

deltaMs = (ta, tb) ->
	nanoSeconds = (ta[0]-tb[0])*1e9 + (ta[1]-tb[1])
	milliSeconds = Math.floor(nanoSeconds*1e-6)
	return milliSeconds

module.exports = class Profiler
	LOG_CUTOFF_TIME: 1000

	constructor: (@name, @args) ->
		@t0 = @t = process.hrtime()
		@start = new Date()
		@updateTimes = []

	log: (label) ->
		t1 = process.hrtime()
		dtMilliSec = deltaMs(t1, @t)
		@t = t1
		@updateTimes.push [label, dtMilliSec] # timings in ms
		return @ # make it chainable

	end: (message) ->
		totalTime = deltaMs(@t, @t0)
		if totalTime > @LOG_CUTOFF_TIME # log anything greater than cutoff
			args = {}
			for k,v of @args
				args[k] = v
			args.updateTimes = @updateTimes
			args.start = @start
			args.end = new Date()
			logger.log args, @name
		return totalTime
