define [
	"base"
], (App) ->

	App.factory 'files', (ide) ->

		Files =
			getTeXFiles: () ->
				texFiles = []
				ide.fileTreeManager.forEachEntity (entity, folder, path) ->
					if entity.type == 'doc' && entity?.name?.match?(/.*\.(tex|sty|cls|dtx|ltx|def)/)
						cloned = _.clone(entity)
						cloned.path = path
						texFiles.push cloned
				return texFiles

		return Files
