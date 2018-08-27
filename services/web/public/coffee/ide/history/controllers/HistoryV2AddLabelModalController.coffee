define [
	"base",
], (App) ->
	App.controller "HistoryV2AddLabelModalController", ["$scope", "$modalInstance", "ide", "update", ($scope, $modalInstance, ide, update) ->
		$scope.update = update
		$scope.inputs = 
			labelName: null
		$scope.state =
			inflight: false
			error: false
			
		$modalInstance.opened.then () ->
			$scope.$applyAsync () ->
				$scope.$broadcast "open"

		$scope.addLabelModalFormSubmit = () ->
			$scope.state.inflight = true
			ide.historyManager.labelCurrentVersion $scope.inputs.labelName
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