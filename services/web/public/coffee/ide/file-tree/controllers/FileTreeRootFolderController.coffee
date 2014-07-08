define [
	"base"
], (App) ->
	App.controller "FileTreeRootFolderController", ["$scope", "ide", ($scope, ide) ->
		rootFolder = $scope.rootFolder
		$scope.onDrop = (events, ui) ->
			source = $(ui.draggable).scope().entity
			return if !source?
			ide.fileTreeManager.moveEntity(source, rootFolder)
	]
