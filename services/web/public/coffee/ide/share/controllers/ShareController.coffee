define [
	"base"
], (App) ->
	App.controller "ShareController", ["$scope", "$modal", "event_tracking", ($scope, $modal, event_tracking) ->
		$scope.openShareProjectModal = () ->
			event_tracking.send 'ide-open-share-modal'

			$modal.open(
				templateUrl: "shareProjectModalTemplate"
				controller:  "ShareProjectModalController"
				scope: $scope
			)
	]
