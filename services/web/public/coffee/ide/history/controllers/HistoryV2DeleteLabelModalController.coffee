define [
	"base",
], (App) ->
	App.controller "HistoryV2DeleteLabelModalController", ["$scope", "$modalInstance", "ide", "labelDetails", ($scope, $modalInstance, ide, labelDetails) ->
		$scope.labelDetails = labelDetails
		$scope.state =
			inflight: false
			error: false

		$scope.deleteLabel = () ->
			$scope.state.inflight = true
			ide.historyManager.deleteLabel labelDetails.id
				.then (response) ->
					$scope.state.inflight = false
					$modalInstance.close()
				.catch (response) ->
					{ data, status } = response
					$scope.state.inflight = false
					if status == 400
						$scope.state.error = { message: data }
					else
						$scope.state.error = true
	]