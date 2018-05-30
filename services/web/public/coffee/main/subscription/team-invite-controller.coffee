define [
	"base"
], (App) ->
	App.controller "TeamInviteController", ($scope, $http) ->

		$scope.inflight = false

		if hasPersonalSubscription
			$scope.view = "personalSubscription"
		else
			$scope.view = "teamInvite"

		$scope.keepPersonalSubscription = ->
			$scope.view = "teamInvite"

		$scope.cancelPersonalSubscription = ->
			$scope.inflight = true
			request = $http.post "/user/subscription/cancel", {_csrf:window.csrfToken}
			request.then ()->
				$scope.inflight = false
				$scope.view = "teamInvite"
			request.catch ()->
				console.log "the request failed"

		$scope.joinTeam = ->
			$scope.view = "requestSent"
			$scope.inflight = true
			request = $http.put "/subscription/invites/:token/", {_csrf:window.csrfToken}
			request.then (response)->
				{ status } = response
				$scope.inflight = false
				if status != 200 # assume request worked
					$scope.requestSent = false
			request.catch ()->
				console.log "the request failed"
