define [
	"ace/ace"
	"ace/ext-language_tools"
], () ->
	Range = ace.require("ace/range").Range

	Helpers =
		getLastCommandFragment: (lineUpToCursor) ->
			if (index = Helpers.getLastCommandFragmentIndex(lineUpToCursor)) > -1
				return lineUpToCursor.slice(index)
			else
				return null

		getLastCommandFragmentIndex: (lineUpToCursor) ->
			# This is hack to let us skip over commands in arguments, and
			# go to the command on the same 'level' as us. E.g.
			#    \includegraphics[width=\textwidth]{..
			# should not match the \textwidth.
			blankArguments = lineUpToCursor.replace /\[([^\]]*)\]/g, (args) ->
				Array(args.length + 1).join('.')
			if m = blankArguments.match(/(\\[^\\]*)$/)
				return m.index
			else
				return -1

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
			closingBrace = if needsClosingBrace then '}' else ''
			return {
				lineUpToCursor,
				commandFragment,
				commandName,
				lineBeyondCursor,
				needsClosingBrace,
				closingBrace
			}

	return Helpers
