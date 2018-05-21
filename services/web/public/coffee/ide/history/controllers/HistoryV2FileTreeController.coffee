define [
	"base"
], (App) ->

	App.controller "HistoryV2FileTreeController", ["$scope", "ide", "_", ($scope, ide, _) ->
		$scope.currentFileTree = []
		_selectedDefaultPathname = (files) ->
			# TODO: Improve heuristic to determine the default pathname to show.
			if files? and files.length > 0
				mainFile = files.find (file) -> /main\.tex$/.test file.pathname
				if mainFile?
					mainFile.pathname
				else
					files[0].pathname

		$scope.handleFileSelection = (file) ->
			$scope.history.selection.pathname = file.pathname

		$scope.$watch 'history.files', (files) ->
			$scope.currentFileTree = _.reduce files, reducePathsToTree, []
			$scope.history.selection.pathname = _selectedDefaultPathname(files)

		reducePathsToTree = (currentFileTree, fileObject) ->
			filePathParts = fileObject.pathname.split "/"
			currentFileTreeLocation = currentFileTree
			for pathPart, index in filePathParts
				isFile = index == filePathParts.length - 1
				if isFile
					fileTreeEntity =
						name: pathPart
						pathname: fileObject.pathname
						type: "file"
						operation: fileObject.operation || "edited"
					currentFileTreeLocation.push fileTreeEntity
				else
					fileTreeEntity = _.find currentFileTreeLocation, (entity) => entity.name == pathPart
					if !fileTreeEntity?
						fileTreeEntity = 
							name: pathPart
							type: "folder"
							children: []
						currentFileTreeLocation.push fileTreeEntity
					currentFileTreeLocation = fileTreeEntity.children				
			return currentFileTree
	]