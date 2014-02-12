define [
	"file-view/FileView"
], (FileView) ->
	class FileViewManager
		constructor: (@ide) ->
			@view = new FileView()

			@ide.mainAreaManager.addArea
				identifier: "file"
				element: @view.$el

			$(window).resize () => @view.onResize()
			@ide.layoutManager.on "resize", () => @view.onResize()
			@view.onResize()

		showFile: (file) ->
			@view.setModel(file)
