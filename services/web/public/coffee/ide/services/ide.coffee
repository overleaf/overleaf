define [
	"base"
], (App) ->
	# We create and provide this as service so that we can access the global ide
	# from within other parts of the angular app.
	App.factory "ide", ["$http", "$modal", ($http, $modal) ->
		ide = {}
		ide.$http = $http

		ide.pushEvent = () ->
			#console.log "PUSHING EVENT STUB", arguments

		ide.reportError = () ->
			console.log "REPORTING ERROR STUB", arguments

		ide.showGenericServerErrorMessage = () ->
			console.error "GENERIC SERVER ERROR MESSAGE STUB"

		ide.showGenericMessageModal = (title, message) ->
			$modal.open {
				templateUrl: "genericMessageModalTemplate"
				controller:  "GenericMessageModalController"
				resolve:
					title:   -> title
					message: -> message
			}

		return ide
	]

	App.controller "GenericMessageModalController", ["$scope", "$modalInstance", "title", "message", ($scope, $modalInstance, title, message) ->
		$scope.title = title
		$scope.message = message

		$scope.done = () ->
			$modalInstance.close()
	]
