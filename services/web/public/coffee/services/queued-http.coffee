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
			# We can't use Angular's $q.defer promises, because it only passes
			# a single argument on error, and $http passes multiple.
			promise = {}
			successCallbacks = []
			errorCallbacks = []

			# Adhere to the $http promise conventions
			promise.success = (callback) ->
				successCallbacks.push callback
				return promise

			promise.error = (callback) ->
				errorCallbacks.push callback
				return promise

			doRequest = () ->
				$http(args...)
					.success (args...) ->
						for cb in successCallbacks
							cb(args...)
					.error (args...) ->
						for cb in errorCallbacks
							cb(args...)

			pendingRequests.push doRequest
			processPendingRequests()

			return promise

		queuedHttp.post = (url, data) ->
			queuedHttp({method: "POST", url: url, data: data})

		return queuedHttp