define [
	"base"
], (App) ->
	App.controller "GroupSubscriptionInviteController", ($scope, $http) ->

		$scope.inflight = false

		if has_personal_subscription
			$scope.view = "personalSubscription"
		else 
			$scope.view = "groupSubscriptionInvite"

		$scope.keepPersonalSubscription = ->
			$scope.view = "groupSubscriptionInvite"

		$scope.cancelSubscription = ->
			$scope.inflight = true
			request = $http.post "/user/subscription/cancel", {_csrf:window.csrfToken}
			request.success (data, status)->
				$scope.inflight = false
				$scope.view = "groupSubscriptionInvite"
			request.error (data, status)->
				console.log "the request failed"					

		$scope.joinGroup = ->
			$scope.view = "requestSent"
			$scope.inflight = true
			request = $http.post "/user/subscription/#{group_subscription_id}/group/begin-join", {_csrf:window.csrfToken}
			request.success (data, status)->
				$scope.inflight = false
				if status != 200 # assume request worked
					$scope.requestSent = false
			request.error (data, status)->
				console.log "the request failed"