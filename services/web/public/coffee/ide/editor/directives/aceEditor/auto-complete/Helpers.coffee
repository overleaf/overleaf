define [
	"ace/ace"
	"ace/ext-language_tools"
], () ->
	Range = ace.require("ace/range").Range

	Helpers =
		getLastCommandFragment: (lineUpToCursor) ->
			if m = lineUpToCursor.match(/(\\[^\\]+)$/)
				return m[1]
			else
				return null

		getCommandNameFromFragment: (commandFragment) ->
			commandFragment?.match(/\\(\w+)\{/)?[1]

		getContext: (editor, pos) ->
			upToCursorRange = new Range(pos.row, 0, pos.row, pos.column)
			lineUpToCursor = editor.getSession().getTextRange(upToCursorRange)
			commandFragment = Helpers.getLastCommandFragment(lineUpToCursor)
			commandName = Helpers.getCommandNameFromFragment(commandFragment)
			beyondCursorRange = new Range(pos.row, pos.column, pos.row, 99999)
			lineBeyondCursor = editor.getSession().getTextRange(beyondCursorRange)
			needsClosingBrace = !lineBeyondCursor.match(/^[^{]*}/)
			return {
				lineUpToCursor,
				commandFragment,
				commandName,
				lineBeyondCursor,
				needsClosingBrace
			}

	return Helpers
