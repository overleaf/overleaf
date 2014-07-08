define [
	"base"
], (App) ->
	App.controller "ShareController", ["$scope", "$modal", ($scope, $modal) ->
		$scope.openShareProjectModal = () ->
			$modal.open(
				templateUrl: "shareProjectModalTemplate"
				controller:  "ShareProjectModalController"
				scope: $scope
			)
	]
