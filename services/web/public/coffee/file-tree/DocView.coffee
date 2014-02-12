define [
	"file-tree/EntityView"
	"libs/mustache"
], (EntityView) ->
	DocView = EntityView.extend
		onClick: (e) ->
			e.preventDefault()
			@options.manager.openDoc(@model)

