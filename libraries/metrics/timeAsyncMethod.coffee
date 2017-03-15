
module.exports = (obj, methodName, key, logger) ->
	metrics = require('./metrics')

	if typeof obj[methodName] != 'function'
		throw new Error("[Metrics] expected object property #{methodName} to be a function")

	realMethod = obj[methodName]
	key = "methods.#{key}"

	obj[methodName] = (originalArgs...) ->

		[firstArgs..., callback] = originalArgs
		if !callback? || typeof callback != 'function'
			throw new Error(
				"[Metrics] expected wrapped method '#{methodName}' to be invoked with a callback"
			)

		timer = new metrics.Timer(key)
		start = new Date()

		realMethod.call this, firstArgs..., (callbackArgs...) ->
			timer.done()
			elapsedTime = new Date() - start
			if logger?
				logger.log {key, elapsedTime}, "[Metrics] timed async method call"
			callback.apply this, callbackArgs
