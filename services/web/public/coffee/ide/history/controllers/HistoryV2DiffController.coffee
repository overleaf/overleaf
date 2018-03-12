define [
	"base"
], (App) ->
	App.controller "HistoryV2DiffController", ($scope, ide, event_tracking) ->
		console.log "HistoryV2DiffController!"

		$scope.restoreState =
			inflight: false
			error: false

		$scope.restoreDeletedFile = () ->
			pathname = $scope.history.selection.pathname
			return if !pathname?
			version = $scope.history.selection.docs[pathname]?.deletedAtV
			return if !version?
			event_tracking.sendMB "history-v2-restore-deleted"
			$scope.restoreState.inflight = true
			$scope.restoreState.error = false
			ide.historyManager
				.restoreFile(version, pathname)
				.then (response) ->
					{ data } = response
					$scope.restoreState.inflight = false
					if data.type == 'doc'
						openDoc(data.id)
				.catch () ->
					$scope.restoreState.error = true

		openDoc = (id) ->
			iterations = 0
			do tryOpen = () ->
				if iterations > 5
					return
				doc = ide.fileTreeManager.findEntityById(id)
				if doc?
					ide.editorManager.openDoc(doc)
				else
					setTimeout(tryOpen, 500)
			