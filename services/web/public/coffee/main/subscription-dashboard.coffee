define [
	"base"
], (App)->
	MESSAGES_URL = "/user/subscription/update"

	App.controller "ChangePlanFormController", ($scope, $modal)->

		$scope.changePlan = ->
			$modal.open(
				templateUrl: "confirmChangePlanModalTemplate"
				controller:  "ConfirmChangePlanController"
				scope: $scope
			)




	App.controller "ConfirmChangePlanController", ($scope, $modalInstance, $http)->
		$scope.confirmChangePlan = ->

			body = 
				plan_code: $scope.plan.planCode
				_csrf : window.csrfToken

			$scope.inflight = true


			$http.post(MESSAGES_URL, body)
				.success ->
					location.reload()
				.error ->
					console.log "something went wrong changing plan"

		$scope.cancel = () ->
			$modalInstance.dismiss('cancel')