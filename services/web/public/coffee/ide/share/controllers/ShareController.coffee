define [
	"base"
], (App) ->
	App.controller "ShareController", ["$scope", "$modal", "event_tracking", ($scope, $modal, event_tracking) ->
		$scope.openShareProjectModal = () ->
			event_tracking.send('share-modal-opened')

			$modal.open(
				templateUrl: "shareProjectModalTemplate"
				controller:  "ShareProjectModalController"
				scope: $scope
			)
	]
