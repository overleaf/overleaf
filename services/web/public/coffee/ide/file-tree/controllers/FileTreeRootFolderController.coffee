define [
	"base"
], (App) ->
	App.controller "FileTreeRootFolderController", ["$scope", "ide", ($scope, ide) ->
		rootFolder = $scope.rootFolder
		$scope.onDrop = (events, ui) ->
			if ide.fileTreeManager.multiSelectedCount()
				entities = ide.fileTreeManager.getMultiSelectedEntityChildNodes() 
			else
				entities = [$(ui.draggable).scope().entity]
			for dropped_entity in entities
				ide.fileTreeManager.moveEntity(dropped_entity, rootFolder)
			$scope.$digest()
			# clear highlight explicitly
			$('.file-tree-inner .droppable-hover').removeClass('droppable-hover')
	]
