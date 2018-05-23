define [
	"base"
], (App) ->

	App.controller "HistoryV2FileTreeController", ["$scope", "ide", "_", ($scope, ide, _) ->
		_previouslySelectedPathname = null
		$scope.currentFileTree = []

		_pathnameExistsInFiles = (pathname, files) -> 
			_.any files, (file) -> file.pathname == pathname

		_getSelectedDefaultPathname = (files) ->
			selectedPathname = null
			if _previouslySelectedPathname? and _pathnameExistsInFiles _previouslySelectedPathname, files
				selectedPathname = _previouslySelectedPathname
			else 
				mainFile = _.find files, (file) -> /main\.tex$/.test file.pathname
				if mainFile?
					selectedPathname = _previouslySelectedPathname = mainFile.pathname
				else
					selectedPathname = _previouslySelectedPathname = files[0].pathname
			return selectedPathname

		$scope.handleFileSelection = (file) ->
			$scope.history.selection.pathname = _previouslySelectedPathname = file.pathname

		$scope.$watch 'history.files', (files) ->
			if files? and files.length > 0
				$scope.currentFileTree = _.reduce files, _reducePathsToTree, []
				$scope.history.selection.pathname = _getSelectedDefaultPathname(files)

		_reducePathsToTree = (currentFileTree, fileObject) ->
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