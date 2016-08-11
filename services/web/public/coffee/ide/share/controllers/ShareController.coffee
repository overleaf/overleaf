define [
	"base"
], (App) ->
	App.controller "ShareController", ["$scope", "$modal", "event_tracking", ($scope, $modal, event_tracking) ->
		$scope.openShareProjectModal = () ->
			event_tracking.sendMBOnce "ide-open-share-modal-once"

			$modal.open(
				templateUrl: "shareProjectModalTemplate"
				controller:  "ShareProjectModalController"
				scope: $scope
			)
	]
