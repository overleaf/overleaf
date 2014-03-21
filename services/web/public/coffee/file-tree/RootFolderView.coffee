define [
	"file-tree/FolderView"
], (FolderView) ->
	RootFolderView = FolderView.extend
		actionsTemplate: $("#fileTreeActionsTemplate").html()

		events: () ->
			events = FolderView::events.apply(this)
			if @ide.isAllowedToDoIt("readAndWrite")
				_.extend(events,
					"click .js-new-file"    : (e) ->
						e.preventDefault()
						@manager.showNewDocModal()
						ga('send', 'event', 'editor-interaction', 'newFile', "topMenu")
					"click .js-new-folder"  : (e) ->
						e.preventDefault()
						@manager.showNewFolderModal()
						ga('send', 'event', 'editor-interaction', 'newFolder', "topMenu")
					"click .js-upload-file" : (e) ->
						e.preventDefault()
						@manager.showUploadFileModal()
						ga('send', 'event', 'editor-interaction', 'uploadFile', "topMenu")
					"click .js-delete-btn"  : (e) ->
						e.preventDefault()
						@manager.confirmDeleteOfSelectedEntity()
						ga('send', 'event', 'editor-interaction', 'deleteEntity', "topMenu")
					"click .js-rename-btn"  : (e) ->
						e.preventDefault()
						@manager.renameSelected()
						ga('send', 'event', 'editor-interaction', 'renameEntity', "topMenu")
				)

		render: () ->
			@$el.append(Mustache.to_html @entityTemplate, {
				name: @manager.project.get("name")
				type: "project"
			})
			@_bindToDomElements()
			if @ide.isAllowedToDoIt("readAndWrite")
				@renderActions()
			@hideRenameBox()
			@hideToggle()
			@renderEntries()
			@showEntries()
			return @

		renderActions: () ->
			actions = $(@actionsTemplate)
			actions.insertAfter(@$entityListItemEl)
			@$(".js-new-entity-menu > a").dropdown()

		onClick: () ->
			e.preventDefault()

		onToggle: () ->
			e.preventDefault()

		getContextMenuEntries: () ->
			@getFolderContextMenuEntries()

		hideToggle: () ->
			@$(".js-toggle").hide()

		


