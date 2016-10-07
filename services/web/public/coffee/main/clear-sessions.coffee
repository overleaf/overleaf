define [
	"base"
], (App) ->
	App.controller "ClearSessionsController", ["$scope", "$http", ($scope, $http) ->

		$scope.state =
			otherSessions: window.otherSessions
			error: false
			success: false

		$scope.clearSessions = () ->
			console.log ">> clearing all sessions"
			$http({method: 'POST', url: "/user/sessions/clear", headers: {'X-CSRF-Token': window.csrfToken}})
			.success () ->
				$scope.state.otherSessions = []
				$scope.state.error = false
				$scope.state.success = true
			.error () ->
				$scope.state.error = true
	]
