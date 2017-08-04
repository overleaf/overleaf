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
					.then () ->
						inflight = false
						processPendingRequests()
					.catch () ->
						inflight = false
						processPendingRequests()

		queuedHttp = (args...) ->
			# We can't use Angular's $q.defer promises, because it only passes
			# a single argument on error, and $http passes multiple.
			promise = {}
			successCallbacks = []
			errorCallbacks = []

			# Adhere to the $http promise conventions
			promise.then = (callback, errCallback) ->
				successCallbacks.push callback
				errorCallbacks.push errCallback if errCallback?
				return promise

			promise.catch = (callback) ->
				errorCallbacks.push callback
				return promise

			doRequest = () ->
				$http(args...)
					.then (args...) ->
						for cb in successCallbacks
							cb(args...)
					.catch (args...) ->
						for cb in errorCallbacks
							cb(args...)

			pendingRequests.push doRequest
			processPendingRequests()

			return promise

		queuedHttp.post = (url, data) ->
			queuedHttp({method: "POST", url: url, data: data})

		return queuedHttp