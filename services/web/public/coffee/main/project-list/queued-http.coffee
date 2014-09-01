define [
	"base"
], (App) ->

	App.factory "queuedHttp", ($http, $q) ->
		pendingRequests = []
		inflight = false

		processPendingRequests = () ->
			return if inflight
			doRequest = pendingRequests.shift()
			if doRequest?
				inflight = true
				doRequest()
					.success () ->
						inflight = false
						processPendingRequests()
					.error () ->
						inflight = false
						processPendingRequests()

		queuedHttp = (args...) ->
			deferred = $q.defer()
			promise = deferred.promise

			# Adhere to the $http promise conventions
			promise.success = (callback) ->
				promise.then(callback)
				return promise

			promise.error = (callback) ->
				promise.catch(callback)
				return promise

			doRequest = () ->
				$http(args...)
					.success (successArgs...) ->
						deferred.resolve(successArgs...)
					.error (errorArgs...) ->
						deferred.reject(errorArgs...)

			pendingRequests.push doRequest
			processPendingRequests()

			return promise

		queuedHttp.post = (url, data) ->
			queuedHttp({method: "POST", url: url, data: data})

		return queuedHttp