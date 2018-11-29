
module.exports = (obj, methodName, prefix, logger) ->
	metrics = require('./metrics')

	if typeof obj[methodName] != 'function'
		throw new Error("[Metrics] expected object property '#{methodName}' to be a function")

	key = "#{prefix}.#{methodName}"

	realMethod = obj[methodName]

	splitPrefix = prefix.split(".")
	startPrefix = splitPrefix[0]

	if splitPrefix[1]?
		modifedMethodName = "#{splitPrefix[1]}_#{methodName}"
	else
		modifedMethodName = methodName
	obj[methodName] = (originalArgs...) ->

		[firstArgs..., callback] = originalArgs

		if !callback? || typeof callback != 'function'
			if logger?
				logger.log "[Metrics] expected wrapped method '#{methodName}' to be invoked with a callback"
			return realMethod.apply this, originalArgs

		timer = new metrics.Timer(startPrefix, null, {method: modifedMethodName})

		realMethod.call this, firstArgs..., (callbackArgs...) ->
			elapsedTime = timer.done()
			possibleError = callbackArgs[0]
			if possibleError? 
				metrics.inc "#{startPrefix}_result", null, {status:"failed", method: modifedMethodName}
			else
				metrics.inc "#{startPrefix}_result", null, {status:"success", method: modifedMethodName}
			if logger?
				loggableArgs = {}
				try
					for arg, idx in firstArgs
						if arg.toString().match(/^[0-9a-f]{24}$/)
							loggableArgs["#{idx}"] = arg
				logger.log {key, args: loggableArgs, elapsedTime}, "[Metrics] timed async method call"
			callback.apply this, callbackArgs
