
module.exports = (obj, methodName, prefix, logger) ->
	metrics = require('./metrics')

	if typeof obj[methodName] != 'function'
		throw new Error("[Metrics] expected object property '#{methodName}' to be a function")

	realMethod = obj[methodName]
	key = "#{prefix}.#{methodName}"

	obj[methodName] = (originalArgs...) ->

		[firstArgs..., callback] = originalArgs
		if !callback? || typeof callback != 'function'
			throw new Error(
				"[Metrics] expected wrapped method '#{methodName}' to be invoked with a callback"
			)

		timer = new metrics.Timer(key)

		realMethod.call this, firstArgs..., (callbackArgs...) ->
			elapsedTime = timer.done()
			if logger?
				logger.log {key, elapsedTime}, "[Metrics] timed async method call"
			callback.apply this, callbackArgs
