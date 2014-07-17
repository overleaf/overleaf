define [
	"base"
], (App) ->
	App.controller 'CloneProjectController', ($scope, $modal) ->
		$scope.openCloneProjectModal = () ->
			$modal.open {
				templateUrl: "cloneProjectModalTemplate"
				controller:  "CloneProjectModalController"
			}