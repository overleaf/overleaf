define [
	"models/Folder"
	"models/Doc"
	"models/File"
	"file-tree/EntityView"
	"file-tree/DocView"
	"file-tree/FileView"
	"utils/Modal"
	"utils/Effects"
	"libs/mustache"
], (Folder, Doc, File, EntityView, DocView, FileView, Modal, Effects) ->
	FolderView = EntityView.extend
		templates:
			childList: $("#entityListTemplate").html()

		entityTemplate: $("#folderTemplate").html()

		events: () ->
			events = EntityView::events.apply(this)
			events["click ##{@model.id} > .js-toggle"] = "onToggle"
			return events

		render: () ->
			EntityView::render.apply(this, arguments)
			@renderEntries()
			return @

		renderEntries: () ->
			@$el.append(Mustache.to_html @templates.childList, @model.attributes)
			@$contents = @$(".contents")
			@$childList = @$(".entity-list")
			@$menu = @$(".js-new-entity-menu")
			@$deleteButton = @$(".js-delete-btn")
			@$toggle = @$entityListItemEl.children(".js-toggle")
			@_renderChildViews()
			@_initializeDrop()
			@hideEntries()

		_renderChildViews: () ->
			throw "Already rendered children" unless !@views?
			@views = []
			@model.get("children").each (child) =>
				view = @_buildViewForModel(child)
				@views.push view
				@$childList.append(view.$el)
				view.render()
			@bindToCollection()

		renderNewEntry: (model, index) ->
			view = @_buildViewForModel(model)
			@views.splice(index, 0, view)
			if index == 0
				@$childList.prepend(view.$el)
			else
				view.$el.insertAfter(@views[index-1].$el)
			view.render()
			Effects.fadeElementIn view.$el

		removeEntry: (model, index) ->
			view = @views[index]
			@views.splice(index,1)
			if model.get("deleted")
				Effects.fadeElementOut view.$el, () ->
					view.remove()
			else
				view.remove()

		_buildViewForModel: (model) ->
			attrs = model: model, manager: @options.manager
			if model instanceof Folder
				view = new FolderView(attrs)
			else if model instanceof Doc
				view = new DocView(attrs)
			else
				view = new FileView(attrs)
			return view

		_initializeDrop: () ->
			onDrop = (event, ui) =>
				if event.target == @$childList[0] or event.target == @$entityListItemEl[0]
					entity = ui.draggable
					entity_id = entity.attr("id")
					entity_type = entity.attr("entity-type")
					@manager.moveEntity entity_id, @model.id, entity_type

			@$entityListItemEl.droppable
				greedy: true
				hoverClass: "droppable-folder-hover"
				drop: onDrop

			@$childList.droppable
				greedy: true
				hoverClass: "droppable-folder-hover"
				drop: onDrop

		bindToCollection: () ->
			@model.get("children").on "add", (model, folderCollection, data) =>
				@renderNewEntry(model, data.index)
			@model.get("children").on "remove", (model, folderCollection, data) =>
				@removeEntry(model, data.index)

		onClick: (e) ->
			e.preventDefault()
			@options.manager.openFolder(@model)

		hideEntries: () ->
			@$contents.hide()
			@$toggle.find(".js-open").hide()
			@$toggle.find(".js-closed").show()

		showEntries: () ->
			@$contents.show()
			@$toggle.find(".js-open").show()
			@$toggle.find(".js-closed").hide()

		onToggle: (e) ->
			e.preventDefault()
			if @$contents.is(":visible")
				@hideEntries()
			else
				@showEntries()

		getContextMenuEntries: (args...) ->
			entries = EntityView::getContextMenuEntries.apply(this, args)
			entries.push {
				divider: true
			}
			entries.push @getFolderContextMenuEntries()...
			return entries

		getFolderContextMenuEntries: () ->
			return [{
				text: "New file"
				onClick: () =>
					ga('send', 'event', 'editor-interaction', 'newFile', "folderView")
					@manager.showNewDocModal(@model)
			}, {
				text: "New folder"
				onClick: () =>
					ga('send', 'event', 'editor-interaction', 'newFolder', "folderView")
					@manager.showNewFolderModal(@model)
			}, {
				text: "Upload file"
				onClick: () =>
					ga('send', 'event', 'editor-interaction', 'uploadFile', "folderView")
					@manager.showUploadFileModal(@model)
			}]

