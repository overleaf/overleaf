define [
	"base"
], (App) ->
	App.controller "FileTreeRootFolderController", ["$scope", "ide", ($scope, ide) ->
		console.log "CREATING FileTreeRootFolderController"
		rootFolder = $scope.rootFolder
		console.log "ROOT FOLDER", rootFolder
		$scope.onDrop = (events, ui) ->
			source = $(ui.draggable).scope().entity
			console.log "DROPPED INTO ROOT", source, rootFolder
			return if !source?
			ide.fileTreeManager.moveEntity(source, rootFolder)
	]
