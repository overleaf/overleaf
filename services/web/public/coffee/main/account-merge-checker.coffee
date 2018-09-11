define [
	"base"
], (App) ->

	# For account-merge-module
	App.controller "SharelatexAccountMergeCheckerController", ($scope, $http) ->
		$scope.hasOlAccount = null
		$scope.olEmail = ""
		$scope.errorCode = null
		$scope.success = null

		$scope.submitEmail = () ->
			return if !$scope.olEmail
			data = {
				overleafEmail: $scope.olEmail
				_csrf: window.csrfToken
			}
			$scope.errorCode = null
			$http.post("/account-merge/email/overleaf", data)
				.then (resp) ->
					$scope.errorCode = null
					$scope.success = true
				.catch (resp) ->
					$scope.errorCode = resp?.data?.errorCode || 'default_error'
					$scope.success = false

	# For integration-module
	App.controller "OverleafAccountMergeCheckerController", ($scope) ->
		$scope.hasOlAccount = null
