define [
	"base"
], (App) ->
	App.controller "AccountSettingsController", ["$scope", "$http", "$modal", ($scope, $http, $modal) ->
		$scope.subscribed = true

		$scope.unsubscribe = () ->
			$scope.unsubscribing = true
			$http({
					method: "DELETE"
					url: "/user/newsletter/unsubscribe"
					headers:
						"X-CSRF-Token": window.csrfToken
				})
				.success () ->
					$scope.unsubscribing = false
					$scope.subscribed = false
				.error () ->
					$scope.unsubscribing = true

		$scope.deleteAccount = () ->
			modalInstance = $modal.open(
				templateUrl: "deleteAccountModalTemplate"
				controller: "DeleteAccountModalController",
				scope: $scope
			)
	]

	App.controller "DeleteAccountModalController", [
		"$scope", "$modalInstance", "$timeout", "$http",
		($scope,   $modalInstance,   $timeout,   $http) ->
			$scope.state =
				isValid : false
				deleteText: ""
				password: ""
				inflight: false
				error: false
				invalidCredentials: false

			$modalInstance.opened.then () ->
				$timeout () ->
					$scope.$broadcast "open"
				, 700

			$scope.checkValidation = ->
				$scope.state.isValid = $scope.state.deleteText == $scope.email and $scope.state.password.length > 0

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
					})
					.success () ->
						$modalInstance.close()
						$scope.state.inflight = false
						$scope.state.error = false
						$scope.state.invalidCredentials = false
						window.location = "/"
					.error (data, status) ->
						$scope.state.inflight = false
						if status == 403
							$scope.state.invalidCredentials = true
						else
							$scope.state.error = true

			$scope.cancel = () ->
				$modalInstance.dismiss('cancel')
	]
