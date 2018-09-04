define [
	"base"
], (App) ->
	App.controller "AccountSettingsController", ["$scope", "$http", "$modal", "event_tracking", "UserAffiliationsDataService", ($scope, $http, $modal, event_tracking, UserAffiliationsDataService) ->
		$scope.subscribed = true

		$scope.unsubscribe = () ->
			$scope.unsubscribing = true
			$http({
					method: "DELETE"
					url: "/user/newsletter/unsubscribe"
					headers:
						"X-CSRF-Token": window.csrfToken
				})
				.then () ->
					$scope.unsubscribing = false
					$scope.subscribed = false
				.catch () ->
					$scope.unsubscribing = true

		$scope.deleteAccount = () ->
			modalInstance = $modal.open(
				templateUrl: "deleteAccountModalTemplate"
				controller: "DeleteAccountModalController"
				resolve:
					userDefaultEmail: () ->
						UserAffiliationsDataService
							.getUserDefaultEmail()
							.then (defaultEmailDetails) ->
								return defaultEmailDetails?.email or null
							.catch () -> null
			)

		$scope.upgradeIntegration = (service) ->
			event_tracking.send 'subscription-funnel', 'settings-page', service
	]

	App.controller "DeleteAccountModalController", [
		"$scope", "$modalInstance", "$timeout", "$http", "userDefaultEmail",
		($scope,   $modalInstance,   $timeout,   $http,   userDefaultEmail) ->
			$scope.state =
				isValid : false
				deleteText: ""
				password: ""
				confirmV1Purge: false
				inflight: false
				error: false
				invalidCredentials: false

			$modalInstance.opened.then () ->
				$timeout () ->
					$scope.$broadcast "open"
				, 700

			$scope.checkValidation = ->
				$scope.state.isValid = userDefaultEmail? and $scope.state.deleteText == userDefaultEmail and $scope.state.password.length > 0 and $scope.state.confirmV1Purge

			$scope.delete = () ->
				$scope.state.inflight = true
				$scope.state.error = false
				$scope.state.invalidCredentials = false
				$http({
						method: "POST"
						url: "/user/delete"
						headers:
							"X-CSRF-Token": window.csrfToken
							"Content-Type": 'application/json'
						data:
							password: $scope.state.password
						disableAutoLoginRedirect: true # we want to handle errors ourselves
					})
					.then () ->
						$modalInstance.close()
						$scope.state.inflight = false
						$scope.state.error = false
						$scope.state.invalidCredentials = false
						setTimeout(
							() ->
								window.location = "/login"
							, 1000
						)
					.catch (response) ->
						{ data, status } = response
						$scope.state.inflight = false
						if status == 403
							$scope.state.invalidCredentials = true
						else
							$scope.state.error = true

			$scope.cancel = () ->
				$modalInstance.dismiss('cancel')
	]
