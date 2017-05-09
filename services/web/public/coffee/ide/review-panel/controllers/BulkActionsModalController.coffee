define [
	"base"
], (App) ->
	App.controller "BulkActionsModalController", ($scope, $modalInstance, isAccept, nChanges) ->
		$scope.isAccept = isAccept
		$scope.nChanges = nChanges
		$scope.cancel = () ->
			$modalInstance.dismiss()
		$scope.confirm = () ->
			$modalInstance.close(isAccept)