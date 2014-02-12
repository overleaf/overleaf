define [
	'search/searchbox'
], (searchbox) ->
	class SearchManager
		constructor: (@ide) ->
			@ide.editor.aceEditor.commands.addCommand
				name: "find",
				bindKey: win: "Ctrl-F", mac: "Command-F"
				exec: (editor) ->
					searchbox.Search(editor)
				readOnly: true

			@ide.editor.on "showCommandLine", (editor, arg) =>
				if arg == "/"
					searchbox.Search(editor)

			@ide.editor.aceEditor.commands.removeCommand "replace"

