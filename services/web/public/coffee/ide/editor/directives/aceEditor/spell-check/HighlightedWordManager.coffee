define [
	"ace/ace"
], () ->
	Range = ace.require("ace/range").Range

	class Highlight
		constructor: (options) ->
			@row = options.row
			@column = options.column
			@word = options.word
			@suggestions = options.suggestions

	class HighlightedWordManager
		constructor: (@editor) ->
			@reset()

		reset: () ->
			@highlights?.rows.forEach (highlight) =>
				@editor.getSession().removeMarker(highlight.markerId)
			@highlights = rows: []

		addHighlight: (highlight) ->
			unless highlight instanceof Highlight
				highlight = new Highlight(highlight)

			session = @editor.getSession()
			doc = session.getDocument()
			# Set up Range that will automatically update it's positions when the
			# document changes
			range = new Range()
			range.start = doc.createAnchor({
				row: highlight.row,
				column: highlight.column
			})
			range.end = doc.createAnchor({
				row: highlight.row,
				column: highlight.column + highlight.word.length
			})

			highlight.markerId = session.addMarker range, "spelling-highlight", 'text', false
			@highlights.rows[highlight.row] ||= []
			@highlights.rows[highlight.row].push highlight

		removeHighlight: (highlight) ->
			@editor.getSession().removeMarker(highlight.markerId)
			for h, i in @highlights.rows[highlight.row]
				if h == highlight
					@highlights.rows[highlight.row].splice(i, 1)

		clearRow: (row) ->
			row = @highlights.rows[row]
			for highlight in (row || []).slice()
				@removeHighlight highlight
