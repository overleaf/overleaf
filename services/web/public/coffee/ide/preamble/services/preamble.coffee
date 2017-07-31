define [
	"base"
], (App) ->

	App.factory 'preamble', (ide) ->

		Preamble =
			getPreambleText: () ->
				text = ide.editorManager.getCurrentDocValue().slice(0, 5000)
				preamble = text.match(/([^]*)^\\begin\{document\}/m)?[1] || ""
				return preamble

			getGraphicsPaths: () ->
				preamble = Preamble.getPreambleText()
				graphicsPathsArgs = preamble.match(/\\graphicspath\{(.*)\}/)?[1] || ""
				paths = []
				re = /\{([^}]*)\}/g
				while match = re.exec(graphicsPathsArgs)
					paths.push(match[1])
				return paths

		window.Preamble = Preamble

		return Preamble
