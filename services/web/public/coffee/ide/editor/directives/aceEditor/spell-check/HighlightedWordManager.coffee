define [
	"ace/ace"
], () ->
	Range = ace.require("ace/range").Range

	class Highlight
		constructor: (@markerId, @range, options) ->
			@word = options.word
			@suggestions = options.suggestions

	class HighlightedWordManager
		constructor: (@editor) ->
			@reset()

		reset: () ->
			@highlights?.forEach (highlight) =>
				@editor.getSession().removeMarker(highlight.markerId)
			@highlights = []

		addHighlight: (options) ->
			session = @editor.getSession()
			doc = session.getDocument()
			# Set up Range that will automatically update it's positions when the
			# document changes
			range = new Range()
			range.start = doc.createAnchor({
				row: options.row,
				column: options.column
			})
			range.end = doc.createAnchor({
				row: options.row,
				column: options.column + options.word.length
			})
			# Prevent range from adding newly typed characters to the end of the word.
			# This makes it appear as if the spelling error continues to the next word
			# even after a space
			range.end.$insertRight = true

			markerId = session.addMarker range, "spelling-highlight", 'text', false

			@highlights.push new Highlight(markerId, range, options)

		removeHighlight: (highlight) ->
			@editor.getSession().removeMarker(highlight.markerId)
			@highlights = @highlights.filter (hl) ->
				hl != highlight

		clearRow: (row) ->
			@highlights.filter (highlight) ->
				highlight.range.start.row == row
			.forEach (highlight) =>
				@removeHighlight(highlight)

		findHighlightWithinRange: (range) ->
			@highlights.find (highlight) =>
				@_doesHighlightOverlapRange highlight, range.start, range.end

		_doesHighlightOverlapRange: (highlight, start, end) ->
			highlightRow = highlight.range.start.row
			highlightStartColumn = highlight.range.start.column
			highlightEndColumn = highlight.range.end.column

			highlightIsAllBeforeRange =
				highlightRow < start.row or
				(highlightRow == start.row and highlightEndColumn <= start.column)
			highlightIsAllAfterRange =
				highlightRow > end.row or
				(highlightRow == end.row and highlightStartColumn >= end.column)
			!(highlightIsAllBeforeRange or highlightIsAllAfterRange)
