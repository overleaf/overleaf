define [
	"ide/file-tree/directives/fileEntity"
	"ide/file-tree/controllers/FileTreeFolderController"
	"ide/file-tree/controllers/FileTreeEntityController"
], () ->
	class FileTreeManager
		constructor: (@ide, @$scope) ->
			@$scope.$on "project:joined", =>
				console.log "Joined"
				@loadRootFolder()

		forEachEntity: (callback) ->
			@_forEachEntityInFolder(@$scope.rootFolder, callback)

		_forEachEntityInFolder: (folder, callback) ->
			for entity in folder.children
				callback(entity)
				if entity.children?
					@_forEachEntityInFolder(entity, callback)

		loadRootFolder: () ->
			@$scope.rootFolder = @_parseFolder(@$scope.project.rootFolder[0])

		_parseFolder: (rawFolder) ->
			folder = {
				name: rawFolder.name
				id:   rawFolder.id
				type: "folder"
				children: []
			}

			for doc in rawFolder.docs or []
				folder.children.push {
					name: doc.name
					type: "doc"
					id:   doc._id
				}

			for file in rawFolder.fileRefs or []
				folder.children.push {
					name: file.name
					type: "file"
					id:   file._id
				}

			for childFolder in rawFolder.folders or []
				folder.children.push @_parseFolder(childFolder)

			return folder
