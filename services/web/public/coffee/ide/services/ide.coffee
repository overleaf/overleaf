define [
	"base"
], (App) ->
	# We create and provide this as service so that we can access the global ide
	# from within other parts of the angular app.
	App.factory "ide", ["$http", "queuedHttp", "$modal", ($http, queuedHttp, $modal) ->
		ide = {}
		ide.$http = $http
		ide.queuedHttp = queuedHttp

		@recentEvents = []
		ide.pushEvent = (type, meta = {}) =>
			@recentEvents.push type: type, meta: meta, date: new Date()
			if @recentEvents.length > 40
				@recentEvents.shift()

		ide.reportError = (error, meta = {}) =>
			meta.client_id = @socket?.socket?.sessionid
			meta.transport = @socket?.socket?.transport?.name
			meta.client_now = new Date()
			meta.recent_events = @recentEvents
			errorObj = {}
			if typeof error == "object"
				for key in Object.getOwnPropertyNames(error)
					errorObj[key] = error[key]
			else if typeof error == "string"
				errorObj.message = error
			$http.post "/error/client", {
				error: errorObj
				meta: meta
				_csrf: window.csrfToken
			}

		ide.showGenericMessageModal = (title, message) ->
			$modal.open {
				templateUrl: "genericMessageModalTemplate"
				controller:  "GenericMessageModalController"
				resolve:
					title:   -> title
					message: -> message
			}

		ide.showLockEditorMessageModal = (title, message) ->
			# modal to block the editor when connection is down
			$modal.open {
				templateUrl: "lockEditorModalTemplate"
				controller:  "GenericMessageModalController"
				backdrop:    "static" # prevent dismiss by click on background
				keyboard:    false    # prevent dismiss via keyboard
				resolve:
					title:   -> title
					message: -> message
				windowClass: "lock-editor-modal"
			}

		return ide
	]

	App.controller "GenericMessageModalController", ["$scope", "$modalInstance", "title", "message", ($scope, $modalInstance, title, message) ->
		$scope.title = title
		$scope.message = message

		$scope.done = () ->
			$modalInstance.close()
	]
