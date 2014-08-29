define [
	"base"
], (App) ->
	App.controller "AnnualUpgradeController",  ($scope, $http, $modal) ->

		MESSAGES_URL = "/user/subscription/upgrade-annual"

		$scope.upgradeComplete = true
		savings = 
			student:"19.2"
			collaborator:"36"
		$scope.$watch $scope.planName, ->
			$scope.yearlySaving = savings[$scope.planName]

		$scope.completeAnnualUpgrade = ->
			body = 
				planName: $scope.planName
				_csrf : window.csrfToken

			$scope.inflight = true


			$http.post(MESSAGES_URL, body)
				.success ->
					$scope.upgradeComplete = true
				.error ->
					console.log "something went wrong changing plan"