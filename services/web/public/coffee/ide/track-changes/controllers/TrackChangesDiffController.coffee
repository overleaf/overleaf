define [
	"base"
], (App) ->
	App.controller "TrackChangesDiffController", ($scope, $modal, ide, event_tracking) ->
		$scope.restoreDeletedDoc = () ->
			event_tracking.sendCountly "track-changes-restore-deleted"
			ide.trackChangesManager.restoreDeletedDoc(
				$scope.trackChanges.diff.doc
			)

		$scope.openRestoreDiffModal = () ->
			event_tracking.sendCountly "track-changes-restore-modal"
			$modal.open {
				templateUrl: "trackChangesRestoreDiffModalTemplate"
				controller: "TrackChangesRestoreDiffModalController"
				resolve:
					diff: () -> $scope.trackChanges.diff
			}

	App.controller "TrackChangesRestoreDiffModalController", ($scope, $modalInstance, diff, ide, event_tracking) ->
		$scope.state =
			inflight: false

		$scope.diff = diff

		$scope.restore = () ->
			event_tracking.sendCountly "track-changes-restored"
			$scope.state.inflight = true
			ide.trackChangesManager
				.restoreDiff(diff)
				.success () ->
					$scope.state.inflight = false
					$modalInstance.close()
					ide.editorManager.openDoc(diff.doc)

		$scope.cancel = () ->
			$modalInstance.dismiss()
