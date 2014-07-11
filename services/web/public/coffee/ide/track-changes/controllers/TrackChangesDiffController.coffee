define [
	"base"
], (App) ->
	App.controller "TrackChangesDiffController", ($scope, $modal, ide) ->
		$scope.restoreDeletedDoc = () ->
			ide.trackChangesManager.restoreDeletedDoc(
				$scope.trackChanges.diff.doc
			)

		$scope.openRestoreDiffModal = () ->
			$modal.open {
				templateUrl: "trackChangesRestoreDiffModalTemplate"
				controller: "TrackChangesRestoreDiffModalController"
				resolve:
					diff: () -> $scope.trackChanges.diff
			}

	App.controller "TrackChangesRestoreDiffModalController", ($scope, $modalInstance, diff, ide) ->
		$scope.state =
			inflight: false

		$scope.diff = diff

		$scope.restore = () ->
			$scope.state.inflight = true
			ide.trackChangesManager
				.restoreDiff(diff)
				.success () ->
					$scope.state.inflight = false
					$modalInstance.close()
					ide.editorManager.openDoc(diff.doc)

		$scope.cancel = () ->
			$modalInstance.dismiss()
