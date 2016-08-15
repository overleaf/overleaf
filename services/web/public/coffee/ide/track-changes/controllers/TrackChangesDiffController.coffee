define [
	"base"
], (App) ->
	App.controller "TrackChangesDiffController", ($scope, $modal, ide, event_tracking) ->
		$scope.restoreDeletedDoc = () ->
			event_tracking.sendMB "track-changes-restore-deleted"
			$scope.trackChanges.diff.restoreInProgress = true
			ide.trackChangesManager
				.restoreDeletedDoc(
					$scope.trackChanges.diff.doc
				)
				.success (response) ->
					$scope.trackChanges.diff.restoredDocNewId = response.doc_id
					$scope.trackChanges.diff.restoreInProgress = false
					$scope.trackChanges.diff.restoreDeletedSuccess = true

		$scope.openRestoreDiffModal = () ->
			event_tracking.sendMB "track-changes-restore-modal"
			$modal.open {
				templateUrl: "trackChangesRestoreDiffModalTemplate"
				controller: "TrackChangesRestoreDiffModalController"
				resolve:
					diff: () -> $scope.trackChanges.diff
			}

		$scope.backToEditorAfterRestore = () ->
			ide.editorManager.openDoc({ id: $scope.trackChanges.diff.restoredDocNewId })

	App.controller "TrackChangesRestoreDiffModalController", ($scope, $modalInstance, diff, ide, event_tracking) ->
		$scope.state =
			inflight: false

		$scope.diff = diff

		$scope.restore = () ->
			event_tracking.sendMB "track-changes-restored"
			$scope.state.inflight = true
			ide.trackChangesManager
				.restoreDiff(diff)
				.success () ->
					$scope.state.inflight = false
					$modalInstance.close()
					ide.editorManager.openDoc(diff.doc)

		$scope.cancel = () ->
			$modalInstance.dismiss()
