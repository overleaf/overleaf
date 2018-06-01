define [
	"base"
], (App) ->
	App.factory "waitFor", ($q) ->
		waitFor = (testFunction, timeout, pollInterval=500) ->
			iterationLimit = Math.floor(timeout / pollInterval)
			iterations = 0
			$q(
				(resolve, reject) ->
					do tryIteration = () ->
						if iterations > iterationLimit
							return reject(new Error("waiting too long, #{JSON.stringify({timeout, pollInterval})}"))
						iterations += 1
						result = testFunction()
						if result?
							resolve(result)
						else
							setTimeout(tryIteration, pollInterval)
			)
		return waitFor
