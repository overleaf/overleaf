define [
	"base"
], (App) ->
	App.controller "GroupSubscriptionInviteController", ($scope, $http) ->

		$scope.requestSent = false

		$scope.joinGroup = ->
			console.log "joingin group"
			request = $http.post "/user/subscription/#{subscription_id}/group/begin_join", {_csrf:window.csrfToken}
			request.success (data, status)->
				$scope.requestSent = true
			request.error (data, status)->
				console.log "the request failed"