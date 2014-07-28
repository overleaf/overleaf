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
				controller: "DeleteAccountModalController"
			)
	]

	App.controller "DeleteAccountModalController", [
		"$scope", "$modalInstance", "$timeout", "$http",
		($scope,   $modalInstance,   $timeout,   $http) ->
			$scope.state = 
				isValid : false
				deleteText: ""
				inflight: false

			$modalInstance.opened.then () ->
				$timeout () ->
					$scope.$broadcast "open"
				, 700

			$scope.checkValidation = ->
				$scope.state.isValid = $scope.state.deleteText == "DELETE"

			$scope.delete = () ->
				$scope.state.inflight = true

				$http({
						method: "DELETE"
						url: "/user"
						headers:
							"X-CSRF-Token": window.csrfToken
					})
					.success () ->
						$modalInstance.close()
						window.location = "/"

			$scope.cancel = () ->
				$modalInstance.dismiss('cancel')
	]