Settings = require('settings-sharelatex')
logger = require('logger-sharelatex')

deltaMs = (ta, tb) ->
	return Math.floor(((ta[0]-tb[0])*1e9 + (ta[1]-tb[1]))*1e-6)

module.exports = class Profiler
	LOG_CUTOFF_TIME: 100

	constructor: (@name, @args) ->
		@t0 = @t = process.hrtime()
		@updateTimes = []

	log: (label) ->
		t1 = process.hrtime()
		dtMilliSec = deltaMs(t1, @t)
		@t = t1
		@updateTimes.push [label, dtMilliSec] # timings in ms
		return @ # make it chainable

	end: (message) ->
		totalTime = deltaMs(@t, @t0)
		return if totalTime < @LOG_CUTOFF_TIME # skip anything less than cutoff
		args = {}
		for k,v of @args
			args[k] = v
		args.updateTimes = @updateTimes
		logger.log args, @name
