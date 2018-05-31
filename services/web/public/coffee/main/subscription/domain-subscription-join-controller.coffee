define [
	"base"
], (App) ->
	App.controller "DomainSubscriptionJoinController", ($scope, $http) ->

		$scope.inflight = false

		if has_personal_subscription
			$scope.view = "personalSubscription"
		else
			$scope.view = "domainSubscriptionJoin"

		$scope.keepPersonalSubscription = ->
			$scope.view = "domainSubscriptionJoin"

		$scope.cancelSubscription = ->
			$scope.inflight = true
			request = $http.post "/user/subscription/cancel", {_csrf:window.csrfToken}
			request.then ()->
				$scope.inflight = false
				$scope.view = "domainSubscriptionJoin"
			request.catch ()->
				console.log "the request failed"

		$scope.joinGroup = ->
			$scope.view = "requestSent"
			$scope.inflight = true
			request = $http.post "/user/subscription/#{group_subscription_id}/group/join", {_csrf:window.csrfToken}
			request.then (response)->
				{ status } = response
				$scope.inflight = false
				if status != 200 # assume request worked
					$scope.requestSent = false
			request.catch ()->
				console.log "the request failed"
