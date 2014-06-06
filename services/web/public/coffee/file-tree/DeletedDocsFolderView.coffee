define [
	"file-tree/FolderView"
], (FolderView) ->
	DeletedDocsFolderView = FolderView.extend
		template: $("#deletedDocsFolderTemplate").html()

		render: () ->
			@$el.append(Mustache.to_html @template, @model.attributes)
			@_bindToDomElements()
			@hideRenameBox()
			@hideToggle()
			@renderEntries()
			@showEntries()
			return @

		onClick: () ->
			e.preventDefault()

		onToggle: () ->
			e.preventDefault()

		getContextMenuEntries: () -> null

		hideToggle: () ->
			@$(".js-toggle").hide()

		


