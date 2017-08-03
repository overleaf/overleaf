define [
	"base"
], (App) ->

	App.factory 'graphics', (ide) ->

		Graphics =
			getGraphicsFiles: () ->
				graphicsFiles = []
				ide.fileTreeManager.forEachEntity (entity, folder, path) ->
					if entity.type == 'file' && entity?.name?.match?(/.*\.(png|jpg|jpeg|pdf|eps)/)
						cloned = _.clone(entity)
						cloned.path = path
						graphicsFiles.push cloned
				return graphicsFiles

		return Graphics
