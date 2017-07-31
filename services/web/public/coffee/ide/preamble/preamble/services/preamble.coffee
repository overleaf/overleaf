define [
	"base"
], (App) ->

	App.factory 'preamble', (ide) ->

		Preamble = {
			getPreambleText: () ->
				text = ide.editorManager.getCurrentDocValue().slice(0, 5000)
				preamble = text.match(/([^]*)^\\begin\{document\}/m)[1]
				
		}

		return Preamble
