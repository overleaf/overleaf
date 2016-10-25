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
				inflight: false
				error: false

			$modalInstance.opened.then () ->
				$timeout () ->
					$scope.$broadcast "open"
				, 700

			$scope.checkValidation = ->
				$scope.state.isValid = $scope.state.deleteText == $scope.email

			$scope.delete = () ->
				$scope.state.inflight = true
				$scope.state.error = false
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
						window.location = "/"
					.error (err) ->
						console.log ">> error", err
						$scope.state.error = true
						$scope.state.inflight = false

			$scope.cancel = () ->
				$modalInstance.dismiss('cancel')
	]
