define [
	"base"
], (App) ->
	App.controller "TrackChangesUpgradeModalController", ($scope, $modalInstance) ->
		$scope.cancel = () ->
			$modalInstance.dismiss()
