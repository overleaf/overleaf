define [
	"base"
], (App) ->
	App.controller "HistoryDiffController", ($scope, $modal, ide, event_tracking) ->
		$scope.restoreDeletedDoc = () ->
			event_tracking.sendMB "history-restore-deleted"
			$scope.history.diff.restoreInProgress = true
			ide.historyManager
				.restoreDeletedDoc(
					$scope.history.diff.doc
				)
				.success (response) ->
					$scope.history.diff.restoredDocNewId = response.doc_id
					$scope.history.diff.restoreInProgress = false
					$scope.history.diff.restoreDeletedSuccess = true

		$scope.openRestoreDiffModal = () ->
			event_tracking.sendMB "history-restore-modal"
			$modal.open {
				templateUrl: "historyRestoreDiffModalTemplate"
				controller: "HistoryRestoreDiffModalController"
				resolve:
					diff: () -> $scope.history.diff
			}

		$scope.backToEditorAfterRestore = () ->
			ide.editorManager.openDoc({ id: $scope.history.diff.restoredDocNewId })

	App.controller "HistoryRestoreDiffModalController", ($scope, $modalInstance, diff, ide, event_tracking) ->
		$scope.state =
			inflight: false

		$scope.diff = diff

		$scope.restore = () ->
			event_tracking.sendMB "history-restored"
			$scope.state.inflight = true
			ide.historyManager
				.restoreDiff(diff)
				.success () ->
					$scope.state.inflight = false
					$modalInstance.close()
					ide.editorManager.openDoc(diff.doc)

		$scope.cancel = () ->
			$modalInstance.dismiss()
