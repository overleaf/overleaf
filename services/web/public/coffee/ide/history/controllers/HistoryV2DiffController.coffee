define [
	"base"
], (App) ->
	App.controller "HistoryV2DiffController", ($scope, ide, event_tracking) ->
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
			ide.historyManager
				.restoreFile(version, pathname)
				.then (response) ->
					{ data } = response
					openEntity(data)
				.catch () ->
					ide.showGenericMessageModal('Sorry, something went wrong with the restore')
				.finally () ->
					$scope.restoreState.inflight = false

		openEntity = (data) ->
			iterations = 0
			{id, type} = data
			do tryOpen = () ->
				if iterations > 5
					return
				iterations += 1
				entity = ide.fileTreeManager.findEntityById(id)
				if entity? and type == 'doc'
					ide.editorManager.openDoc(entity)
				else if entity? and type == 'file'
					ide.binaryFilesManager.openFile(entity)
				else
					setTimeout(tryOpen, 500)
			