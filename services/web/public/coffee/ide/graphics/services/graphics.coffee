define [
	"base"
], (App) ->

	App.factory 'graphics', (ide) ->

		Graphics =
			getGraphicsFiles: () ->
				graphicsFiles = []
				ide.fileTreeManager.forEachEntity (f) ->
					if f?.name?.match?(/.*\.(png|jpg|jpeg)/)
						graphicsFiles.push f
				return graphicsFiles

		return Graphics
