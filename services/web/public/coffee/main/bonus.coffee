define [
	"base"
], (App) ->
	App.controller "BonusLinksController", ($scope, $modal) ->
		$scope.openLinkToUsModal = ->
			$modal.open {
				templateUrl: "BonusLinkToUsModal"
				controller:  "BonusModalController"
			}
			
	App.controller "BonusModalController", ($scope, $modalInstance)->

		$scope.cancel = () ->
			$modalInstance.dismiss()
