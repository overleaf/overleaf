define [
	"models/Doc"
	"models/File"
	"models/Folder"
	"file-tree/FileTreeView"
	"file-tree/FolderView"
	"utils/Effects"
	"utils/Modal"
	"libs/backbone"
	"libs/jquery.storage"
], (Doc, File, Folder, FileTreeView, FolderView, Effects, Modal) ->
	class FileTreeManager
		constructor: (@ide) ->
			_.extend(@, Backbone.Events)
			@views = {}
			@multiSelectedEntities = []
			@ide.on "afterJoinProject", (@project) =>
				@populateFileTree()
				@project_id = @project.id
				if @ide.editor?.current_doc_id?
					@openDoc(@ide.editor.current_doc_id)
				else if location.hash.length > 1
					fileName = location.hash.slice(1)
					@openDocByPath(fileName)
				else if openDoc_id = $.localStorage("doc.open_id.#{@project_id}") and @getEntity(openDoc_id)
					@openDoc(openDoc_id)
				else if @project.get("rootDoc_id")?
					@openDoc(project.get("rootDoc_id"))
				else
					$('#settings').click()
			@view = new FileTreeView(@)
			@ide.sideBarView.addLink
				identifier: "file-tree"
				element:    @view.$el
				prepend:    true
			@view.render()
			@listenForUpdates()

		populateFileTree: () ->
			@view.bindToRootFolder(@project.get("rootFolder"))
			@deletedDocsView = new FolderView(model: @project.get("deletedDocs"), manager: @)
			@deletedDocsView.render()
			$("#sections").append(@deletedDocsView.$el)
			@hideDeletedDocs()

		listenForUpdates: () ->
			@ide.socket.on 'reciveNewDoc', (folder_id, doc) =>
				@addEntityToFolder(
					new Doc(id: doc._id, name: doc.name)
					folder_id
				)
		
			@ide.socket.on 'reciveNewFolder', (folder_id, folder) =>
				@addEntityToFolder(
					new Folder(id: folder._id, name: folder.name)
					folder_id
				)
		
			@ide.socket.on 'reciveNewFile', (folder_id, file) =>
				@addEntityToFolder(
					new File(id: file._id, name: file.name)
					folder_id
				)
			
			@ide.socket.on 'removeEntity', (entity_id) =>
				@onDeleteEntity(entity_id)
	
			@ide.socket.on 'reciveEntityRename', (entity_id, newName) =>
				@onRenameEntity(entity_id, newName)

			@ide.socket.on 'reciveEntityMove', (entity_id, folder_id) =>
				@onMoveEntity(entity_id, folder_id)

		registerView: (entity_id, view) ->
			@views[entity_id] = view

		addEntityToFolder: (entity, folder_id) ->
			folder = @views[folder_id].model
			children = folder.get("children")
			children.add(entity)

		openDoc: (doc, line) ->
			return if !doc?
			doc_id = doc.id or doc
			@trigger "open:doc", doc_id, line: line
			@selectEntity(doc_id)
			$.localStorage "doc.open_id.#{@project_id}", doc_id

		openDocByPath: (path, line) ->
			doc_id = @getDocIdOfPath(path)
			return null if !doc_id?
			@openDoc(doc_id, line)

		openFile: (file) ->
			@trigger "open:file", file
			@selectEntity(file.id)

		openFolder: (folder) ->
			@selectEntity(folder.id)

		selectEntity: (entity_id) ->
			if @views[@selected_entity_id]?
				@views[@selected_entity_id].deselect()
			@selected_entity_id = entity_id
			@ide.sideBarView.deselectAll()
			@views[entity_id]?.select()

		getEntity: (entity_id, options = {include_deleted: false}) ->
			model = @views[entity_id]?.model
			if !model? or (model.get("deleted") and !options.include_deleted)
				return
			else
				return model

		getSelectedEntity: () -> @getEntity(@selected_entity_id)
		getSelectedEntityId: () -> @getSelectedEntity()?.id

		getCurrentFolder: () ->
			selected_entity = @getSelectedEntity()
			if !selected_entity?
				return @project.get("rootFolder")
			else if selected_entity instanceof Folder
				return selected_entity
			else
				return selected_entity.collection.parentFolder

		getDocIdOfPath: (path) ->
			parts = path.split("/")
			folder = @project.get("rootFolder")
			lastPart = parts.pop()

			getChildWithName = (folder, name) ->
				return folder if name == "."
				foundChild = null
				for child in folder.get("children").models
					if child.get("name") == name
						foundChild = child
				return foundChild

			for part in parts
				folder = getChildWithName(folder, part)
				return null if !folder or !(folder instanceof Folder)

			doc = getChildWithName(folder, lastPart)
			return null if !doc or !(doc instanceof Doc)
			return doc.id

		getPathOfEntityId: (entity_id) ->
			entity = @getEntity(entity_id)
			return if !entity?
			path = entity.get("name")
			while (entity = entity.collection?.parentFolder)
				if entity.collection?
					# it's not the root folder so keep going
					path = entity.get("name") + "/" + path
			return path

		getRootFolderPath: () ->
			rootFilePath = @getPathOfEntityId(@project.get("rootDoc_id"))
			return rootFilePath.split("/").slice(0, -1).join("/")

		getNameOfEntityId: (entity_id) ->
			entity = @getEntity(entity_id)
			return if !entity?
			return entity.get("name")
			
		# RENAMING
		renameSelected: () ->
			entity_id = @getSelectedEntityId()
			return if !entity_id?
			@views[entity_id]?.startRename()
			ga('send', 'event', 'editor-interaction', 'renameEntity', "topMenu")


		renameEntity: (entity, name) ->
			name = name?.trim()
			@ide.socket.emit 'renameEntity', entity.id, entity.get("type"), name
			entity.set("name", name)

		onRenameEntity: (entity_id, name) ->
			@getEntity(entity_id)?.set("name", name)

		# MOVING
		onMoveEntity: (entity_id, folder_id) ->
			entity = @getEntity(entity_id)
			destFolder = @getEntity(folder_id)
			return if !entity? or !destFolder?
			if entity.collection == destFolder.get("children")
				# Already in parent folder
				return
			return if @_isParent(entity_id, folder_id)

			entity.collection.remove(entity)
			destFolder.get("children").add(entity)

		_isParent: (parent_folder_id, child_folder_id) ->
			childFolder = @getEntity(child_folder_id)
			return false unless childFolder? and childFolder instanceof Folder
			parentIds = childFolder.getParentFolderIds()
			if parentIds.indexOf(parent_folder_id) > -1
				return true
			else
				return false

		moveEntity: (entity_id, folder_id, type) ->
			return if @_isParent(entity_id, folder_id)
			@ide.socket.emit 'moveEntity', entity_id, folder_id, type
			@onMoveEntity(entity_id, folder_id)
			
		# CREATING
		showNewEntityModal: (type, defaultName, callback = (name) ->) ->
			el = $($("#newEntityModalTemplate").html())
			input = el.find("input")
			create = _.once () =>
				name = input.val()?.trim()
				if name != ""
					callback(name)
			modal = new Modal
				title: "New #{type}"
				el: el
				buttons: [{
					text: "Cancel"
				}, {
					text: "Create"
					callback: create
					class: "btn-primary"
				}]
			input.on "keydown", (e) ->
				if e.keyCode == 13 # Enter
					create()
					modal.remove()

			input.val(defaultName.replace("|", ""))
			if input[0].setSelectionRange?
				# value is "name.tex"
				input[0].setSelectionRange(0, defaultName.indexOf("|"))

		showNewDocModal: (parentFolder = @getCurrentFolder()) ->
			return if !parentFolder?
			@showNewEntityModal "Document", "name|.tex", (name) =>
				@addDocToFolder parentFolder, name
				
		showNewFolderModal:  (parentFolder = @getCurrentFolder()) ->
			return if !parentFolder?
			@showNewEntityModal "Folder", "name|", (name) =>
				@addFolderToFolder parentFolder, name

		showUploadFileModal: (parentFolder = @getCurrentFolder()) ->
			return if !parentFolder?
			@ide.fileUploadManager.showUploadDialog parentFolder.id

		addDoc: (folder_id, name) ->
			@ide.socket.emit 'addDoc', folder_id, name

		addDocToFolder: (parentFolder, name) ->
			@addDoc parentFolder.id, name

		addFolder: (parent_folder_id, name) ->
			@ide.socket.emit 'addFolder', parent_folder_id, name

		addFolderToFolder: (parentFolder, name) ->
			return if !parentFolder?
			@addFolder parentFolder.id, name

		# DELETING
		confirmDelete: (entity) ->
			ga('send', 'event', 'editor-interaction', 'deleteEntity', "topMenu")
			Modal.createModal
				title: "Confirm Deletion"
				message: "Are you sure you want to delete <strong>#{entity.get("name")}</strong>?"
				buttons: [{
					text: "Cancel"
					class: "btn"
				},{
					text: "Delete"
					class: "btn btn-danger"
					callback: () => @_doDelete(entity)
				}]

		confirmDeleteOfSelectedEntity: () ->
			entity = @getSelectedEntity()
			return if !entity?
			@confirmDelete(entity)

		_doDelete: (entity) ->
			@ide.socket.emit 'deleteEntity', entity.id, entity.get("type")
			if entity.get("type") == "doc"
				@project.get("deletedDocs").get("children").add entity
			@onDeleteEntity entity.id

		onDeleteEntity: (entity_id) ->
			entity = @getEntity(entity_id)
			return if !entity?
			entity.set("deleted", true)
			entity.collection?.remove(entity)
			delete @views[entity_id]
			
		setLabels: (labels) ->
			@view.setLabels(labels)
			@deletedDocsView.setLabels(labels)

		showDeletedDocs: () ->
			@deletedDocsView.$el.show()

		hideDeletedDocs: () ->
			@deletedDocsView.$el.hide()
