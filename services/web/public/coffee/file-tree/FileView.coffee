define [
	"file-tree/EntityView"
	"libs/mustache"
], (EntityView) ->
	FileView = EntityView.extend
		onClick: (e) ->
			e.preventDefault()
			@options.manager.openFile(@model)
