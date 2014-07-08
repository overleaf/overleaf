define [
	"base"
], (App) ->
	App.controller "TrackChangesDiffController", ["$scope", "ide", ($scope, ide) ->
		$scope.restoreDeletedDoc = () ->
			ide.trackChangesManager.restoreDeletedDoc(
				$scope.trackChanges.diff.doc
			)
	]