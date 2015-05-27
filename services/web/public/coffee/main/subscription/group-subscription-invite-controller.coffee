define [
	"base"
], (App) ->
	App.controller "GroupSubscriptionInviteController", ($scope, $http) ->

		$scope.requestSent = false

		$scope.joinGroup = ->
			$scope.requestSent = true
			request = $http.post "/user/subscription/#{subscription_id}/group/begin-join", {_csrf:window.csrfToken}
			request.success (data, status)->
				if status != 200 # assume request worked
					$scope.requestSent = false
			request.error (data, status)->
				console.log "the request failed"