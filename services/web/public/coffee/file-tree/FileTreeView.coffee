define [
	"file-tree/RootFolderView"
	"libs/backbone"
], (RootFolderView) ->
	FileTreeView = Backbone.View.extend
		initialize: (@manager) ->

		template: $("#fileTreeTemplate").html()

		render: () ->
			@$el.append($(@template))
			return @

		bindToRootFolder: (rootFolder) ->
			entities = @$('.js-file-tree')
			# This is hacky, we're doing nothing to clean up the old folder tree
			# from memory, just removing it from the DOM.
			entities.empty()
			@rootFolderView = new RootFolderView(model: rootFolder, manager: @manager)
			entities.append(@rootFolderView.$el)
			@rootFolderView.render()

		setLabels: (labels) ->
			@rootFolderView.setLabels(labels)
			
