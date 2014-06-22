define [
	"ide/file-tree/directives/fileEntity"
	"ide/file-tree/controllers/FileTreeController"
	"ide/file-tree/controllers/FileTreeFolderController"
	"ide/file-tree/controllers/FileTreeEntityController"
], () ->
	class FileTreeManager
		constructor: (@ide, @$scope) ->
			@$scope.$on "project:joined", =>
				@loadRootFolder()

			@_bindToSocketEvents()

		_bindToSocketEvents: () ->
			@ide.socket.on "reciveNewDoc", (parent_folder_id, doc) =>
				parent_folder = @findEntityById(parent_folder_id) or @$scope.rootFolder
				@$scope.$apply () ->
					parent_folder.children.push {
						name: doc.name
						id:   doc._id
						type: "doc"
					}

			@ide.socket.on "reciveNewFile", (parent_folder_id, file) =>
				parent_folder = @findEntityById(parent_folder_id) or @$scope.rootFolder
				@$scope.$apply () ->
					parent_folder.children.push {
						name: file.name
						id:   file._id
						type: "file"
					}

			@ide.socket.on "reciveNewFolder", (parent_folder_id, folder) =>
				parent_folder = @findEntityById(parent_folder_id) or @$scope.rootFolder
				@$scope.$apply () ->
					parent_folder.children.push {
						name: folder.name
						id:   folder._id
						type: "folder"
						children: []
					}

		findEntityById: (id) ->
			@_findEntityByIdInFolder @$scope.rootFolder, id

		_findEntityByIdInFolder: (folder, id) ->
			for entity in folder.children or []
				if entity.id == id
					return entity
				else if entity.children?
					result = @_findEntityByIdInFolder(entity, id)
					return result if result?

			return null

		forEachEntity: (callback) ->
			@_forEachEntityInFolder(@$scope.rootFolder, callback)

		_forEachEntityInFolder: (folder, callback) ->
			for entity in folder.children or []
				callback(entity)
				if entity.children?
					@_forEachEntityInFolder(entity, callback)

		# forEachFolder: (callback) ->
		# 	@forEachEntity (entity) ->
		# 		if entity.type == "folder"
		# 			callback(entity)

		loadRootFolder: () ->
			@$scope.rootFolder = @_parseFolder(@$scope.project.rootFolder[0])

		_parseFolder: (rawFolder) ->
			folder = {
				name: rawFolder.name
				id:   rawFolder._id
				type: "folder"
				children: []
			}

			for doc in rawFolder.docs or []
				folder.children.push {
					name: doc.name
					id:   doc._id
					type: "doc"
				}

			for file in rawFolder.fileRefs or []
				folder.children.push {
					name: file.name
					id:   file._id
					type: "file"
				}

			for childFolder in rawFolder.folders or []
				folder.children.push @_parseFolder(childFolder)

			return folder

		getCurrentFolder: (startFolder = @$scope.rootFolder) ->
			for entity in startFolder.children or []
				# The 'current' folder is either the one selected, or
				# the one containing the selected doc/file
				if entity.selected
					if entity.type == "folder"
						return entity
					else
						return startFolder

				if entity.type == "folder"
					result = @getCurrentFolder(entity)
					return result if result?

			return null

		createDocInCurrentFolder: (name, callback = (error, doc) ->) ->
			# We'll wait for the socket.io notification to actually
			# add the doc for us.
			parent_folder = @getCurrentFolder()
			$.ajax {
				url:  "/project/#{@ide.project_id}/doc"
				type: "POST"
				contentType: "application/json; charset=utf-8"
				data: JSON.stringify {
					name: name,
					parent_folder_id: parent_folder?.id
					_csrf: window.csrfToken
				}
				dataType: "json"
				success: (doc) ->
					callback(null, doc)
				failure: (error) -> callback(error)
			}

		createFolderInCurrentFolder: (name, callback = (error, doc) ->) ->
			# We'll wait for the socket.io notification to actually
			# add the folder for us.
			parent_folder = @getCurrentFolder()
			$.ajax {
				url:  "/project/#{@ide.project_id}/folder"
				type: "POST"
				contentType: "application/json; charset=utf-8"
				data: JSON.stringify {
					name: name,
					parent_folder_id: parent_folder?.id
					_csrf: window.csrfToken
				}
				dataType: "json"
				success: (folder) ->
					callback(null, folder)
				failure: (error) -> callback(error)
			}
