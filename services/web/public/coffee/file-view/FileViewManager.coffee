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

			@bindToFileTreeEvents()
			@enable()

		bindToFileTreeEvents: () ->
			@ide.fileTreeManager.on "open:file", (file) =>
				if @enabled
					@showFile(file)

		showFile: (file) ->
			@ide.mainAreaManager.change('file')
			@view.setModel(file)

		enable: () ->
			@enabled = true

		disable: () ->
			@enabled = false
