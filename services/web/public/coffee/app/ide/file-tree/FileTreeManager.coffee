define [
	"ide/file-tree/directives/fileEntity"
	"ide/file-tree/directives/draggable"
	"ide/file-tree/directives/droppable"
	"ide/file-tree/controllers/FileTreeController"
	"ide/file-tree/controllers/FileTreeEntityController"
	"ide/file-tree/controllers/FileTreeFolderController"
], () ->
	class FileTreeManager
		constructor: (@ide, @$scope) ->
			@$scope.$on "project:joined", =>
				@loadRootFolder()
				@loadDeletedDocs()
				@$scope.$emit "file-tree:initialized"

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

			@ide.socket.on "reciveEntityRename", (entity_id, name) =>
				entity = @findEntityById(entity_id)
				return if !entity?
				@$scope.$apply () ->
					entity.name = name

			@ide.socket.on "removeEntity", (entity_id) =>
				entity = @findEntityById(entity_id)
				return if !entity?
				@$scope.$apply () =>
					@_deleteEntityFromScope entity

			@ide.socket.on "reciveEntityMove", (entity_id, folder_id) =>
				entity = @findEntityById(entity_id)
				folder = @findEntityById(folder_id)
				@$scope.$apply () =>
					@_moveEntityInScope(entity, folder)

		selectEntity: (entity) ->
			@selected_entity_id = entity.id # For reselecting after a reconnect
			@ide.fileTreeManager.forEachEntity (entity) ->
				entity.selected = false
			entity.selected = true

		findEntityById: (id, options = {}) ->
			entity = @_findEntityByIdInFolder @$scope.rootFolder, id
			return entity if entity?

			if options.includeDeleted
				for entity in @$scope.deletedDocs
					return entity if entity.id == id

			return null

		_findEntityByIdInFolder: (folder, id) ->
			for entity in folder.children or []
				if entity.id == id
					return entity
				else if entity.children?
					result = @_findEntityByIdInFolder(entity, id)
					return result if result?

			return null

		findEntityByPath: (path) ->
			@_findEntityByPathInFolder @$scope.rootFolder, path

		_findEntityByPathInFolder: (folder, path) ->
			parts = path.split("/")
			name = parts.shift()
			rest = parts.join("/")
			
			if name == "."
				return @_findEntityByPathInFolder(folder, rest)

			for entity in folder.children
				if entity.name == name
					if rest == ""
						return entity
					else if entity.type == "folder"
						return @_findEntityByPathInFolder(entity, rest)
			return null

		forEachEntity: (callback = (entity, parent_folder) ->) ->
			@_forEachEntityInFolder(@$scope.rootFolder, callback)

			for entity in @$scope.deletedDocs or []
				callback(entity)

		_forEachEntityInFolder: (folder, callback) ->
			for entity in folder.children or []
				callback(entity, folder)
				if entity.children?
					@_forEachEntityInFolder(entity, callback)

		getEntityPath: (entity) ->
			@_getEntityPathInFolder @$scope.rootFolder, entity

		_getEntityPathInFolder: (folder, entity) ->
			for child in folder.children or []
				if child == entity
					return entity.name
				else if child.type == "folder"
					path = @_getEntityPathInFolder(child, entity)
					if path?
						return child.name + "/" + path
			return null

		getRootDocDirname: () ->
			rootDoc = @findEntityById @$scope.project.rootDoc_id
			return if !rootDoc?
			path = @getEntityPath(rootDoc)
			return if !path?
			return path.split("/").slice(0, -1).join("/")

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
				selected: (rawFolder._id == @selected_entity_id)
			}

			for doc in rawFolder.docs or []
				folder.children.push {
					name: doc.name
					id:   doc._id
					type: "doc"
					selected: (doc._id == @selected_entity_id)
				}

			for file in rawFolder.fileRefs or []
				folder.children.push {
					name: file.name
					id:   file._id
					type: "file"
					selected: (file._id == @selected_entity_id)
				}

			for childFolder in rawFolder.folders or []
				folder.children.push @_parseFolder(childFolder)

			return folder

		loadDeletedDocs: () ->
			@$scope.deletedDocs = []
			for doc in @$scope.project.deletedDocs
				@$scope.deletedDocs.push {
					name: doc.name
					id:   doc._id
					type: "doc"
					deleted: true
				}

		getCurrentFolder: () ->
			# Return the root folder if nothing is selected
			@_getCurrentFolder(@$scope.rootFolder) or @$scope.rootFolder

		_getCurrentFolder: (startFolder = @$scope.rootFolder) ->
			for entity in startFolder.children or []
				# The 'current' folder is either the one selected, or
				# the one containing the selected doc/file
				if entity.selected
					if entity.type == "folder"
						return entity
					else
						return startFolder

				if entity.type == "folder"
					result = @_getCurrentFolder(entity)
					return result if result?

			return null

		createDoc: (name, parent_folder = @getCurrentFolder()) ->
			# We'll wait for the socket.io notification to actually
			# add the doc for us.
			@ide.$http.post "/project/#{@ide.project_id}/doc", {
				name: name,
				parent_folder_id: parent_folder?.id
				_csrf: window.csrfToken
			}

		createFolder: (name, parent_folder = @getCurrentFolder()) ->
			# We'll wait for the socket.io notification to actually
			# add the folder for us.
			return @ide.$http.post "/project/#{@ide.project_id}/folder", {
				name: name,
				parent_folder_id: parent_folder?.id
				_csrf: window.csrfToken
			}

		renameEntity: (entity, name, callback = (error) ->) ->
			return if entity.name == name
			entity.name = name
			return @ide.$http.post "/project/#{@ide.project_id}/#{entity.type}/#{entity.id}/rename", {
				name: name,
				_csrf: window.csrfToken
			}

		deleteEntity: (entity, callback = (error) ->) ->
			# We'll wait for the socket.io notification to 
			# delete from scope.
			return @ide.$http {
				method: "DELETE"
				url:    "/project/#{@ide.project_id}/#{entity.type}/#{entity.id}"
				headers:
					"X-Csrf-Token": window.csrfToken
			}

		moveEntity: (entity, parent_folder, callback = (error) ->) ->
			@_moveEntityInScope(entity, parent_folder)
			return @ide.$http.post "/project/#{@ide.project_id}/#{entity.type}/#{entity.id}/move", {
				folder_id: parent_folder.id
				_csrf: window.csrfToken
			}

		_deleteEntityFromScope: (entity) ->
			parent_folder = null
			@forEachEntity (possible_entity, folder) ->
				if possible_entity == entity
					parent_folder = folder

			if parent_folder?
				index = parent_folder.children.indexOf(entity)
				if index > -1
					parent_folder.children.splice(index, 1)

			if entity.type == "doc"
				entity.deleted = true
				@$scope.deletedDocs.push entity

		_moveEntityInScope: (entity, parent_folder) ->
			return if entity in parent_folder.children
			@_deleteEntityFromScope(entity)
			parent_folder.children.push(entity)
