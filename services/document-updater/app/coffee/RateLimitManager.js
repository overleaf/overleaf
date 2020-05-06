Settings = require('settings-sharelatex')
logger = require('logger-sharelatex')
Metrics = require('./Metrics')

module.exports = class RateLimiter

	constructor: (number = 10) ->
		@ActiveWorkerCount = 0
		@CurrentWorkerLimit = number
		@BaseWorkerCount = number

	_adjustLimitUp: () ->
		@CurrentWorkerLimit += 0.1 # allow target worker limit to increase gradually
		Metrics.gauge "currentLimit", Math.ceil(@CurrentWorkerLimit)

	_adjustLimitDown: () ->
		@CurrentWorkerLimit = Math.max @BaseWorkerCount, (@CurrentWorkerLimit * 0.9)
		logger.log {currentLimit: Math.ceil(@CurrentWorkerLimit)}, "reducing rate limit"
		Metrics.gauge "currentLimit", Math.ceil(@CurrentWorkerLimit)

	_trackAndRun: (task, callback = () ->) ->
		@ActiveWorkerCount++
		Metrics.gauge "processingUpdates", @ActiveWorkerCount
		task (err) =>
			@ActiveWorkerCount--
			Metrics.gauge "processingUpdates", @ActiveWorkerCount
			callback(err)

	run: (task, callback) ->
		if @ActiveWorkerCount < @CurrentWorkerLimit
			@_trackAndRun task  # below the limit, just put the task in the background
			callback()         # return immediately
			if @CurrentWorkerLimit > @BaseWorkerCount
				@_adjustLimitDown()
		else
			logger.log {active: @ActiveWorkerCount, currentLimit: Math.ceil(@CurrentWorkerLimit)}, "hit rate limit"
			@_trackAndRun task, (err) =>
				@_adjustLimitUp() if !err? # don't increment rate limit if there was an error
				callback(err) # only return after task completes
