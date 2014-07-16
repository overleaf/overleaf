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
			@highlights = rows: []

		addHighlight: (highlight) ->
			unless highlight instanceof Highlight
				highlight = new Highlight(highlight)
			range = new Range(
				highlight.row, highlight.column,
				highlight.row, highlight.column + highlight.word.length
			)
			highlight.markerId = @editor.getSession().addMarker range, "spelling-highlight"
			@highlights.rows[highlight.row] ||= []
			@highlights.rows[highlight.row].push highlight

		removeHighlight: (highlight) ->
			@editor.getSession().removeMarker(highlight.markerId)
			for h, i in @highlights.rows[highlight.row]
				if h == highlight
					@highlights.rows[highlight.row].splice(i, 1)

		removeWord: (word) ->
			toRemove = []
			for row in @highlights.rows
				for highlight in (row || [])
					if highlight.word == word
						toRemove.push(highlight)
			for highlight in toRemove
				@removeHighlight highlight

		moveHighlight: (highlight, position) ->
			@removeHighlight highlight
			highlight.row = position.row
			highlight.column = position.column
			@addHighlight highlight

		clearRows: (from, to) ->
			from ||= 0
			to ||= @highlights.rows.length - 1
			for row in @highlights.rows.slice(from, to + 1)
				for highlight in (row || []).slice(0)
					@removeHighlight highlight

		insertRows: (offset, number) ->
			# rows are inserted after offset. i.e. offset row is not modified
			affectedHighlights = []
			for row in @highlights.rows.slice(offset)
				affectedHighlights.push(highlight) for highlight in (row || [])
			for highlight in affectedHighlights
				@moveHighlight highlight,
					row: highlight.row + number
					column: highlight.column

		removeRows: (offset, number) ->
			# offset is the first row to delete
			affectedHighlights = []
			for row in @highlights.rows.slice(offset)
				affectedHighlights.push(highlight) for highlight in (row || [])
			for highlight in affectedHighlights
				if highlight.row >= offset + number
					@moveHighlight highlight,
						row: highlight.row - number
						column: highlight.column
				else
					@removeHighlight highlight

		findHighlightWithinRange: (range) ->
			rows = @highlights.rows.slice(range.start.row, range.end.row + 1)
			for row in rows
				for highlight in (row || [])
					if @_doesHighlightOverlapRange(highlight, range.start, range.end)
						return highlight
			return null

		applyChange: (change) ->
			start = change.range.start
			end = change.range.end
			if change.action == "insertText"
				if start.row != end.row
					rowsAdded = end.row - start.row
					@insertRows start.row + 1, rowsAdded
				# make a copy since we're going to modify in place
				oldHighlights = (@highlights.rows[start.row] || []).slice(0)
				for highlight in oldHighlights
					if highlight.column > start.column
						# insertion was fully before this highlight
						@moveHighlight highlight,
							row: end.row
							column: highlight.column + (end.column - start.column)
					else if highlight.column + highlight.word.length >= start.column
						# insertion was inside this highlight
						@removeHighlight highlight

			else if change.action == "insertLines"
				@insertRows start.row, change.lines.length

			else if change.action == "removeText"
				if start.row == end.row
					oldHighlights = (@highlights.rows[start.row] || []).slice(0)
				else
					rowsRemoved = end.row - start.row
					oldHighlights =
						(@highlights.rows[start.row] || []).concat(
							(@highlights.rows[end.row] || [])
						)
					@removeRows start.row + 1, rowsRemoved

				for highlight in oldHighlights
					if @_doesHighlightOverlapRange highlight, start, end
						@removeHighlight highlight
					else if @_isHighlightAfterRange highlight, start, end
						@moveHighlight highlight,
							row: start.row
							column: highlight.column - (end.column - start.column)

			else if change.action == "removeLines"
				@removeRows start.row, change.lines.length

		_doesHighlightOverlapRange: (highlight, start, end) ->
			highlightIsAllBeforeRange =
				highlight.row < start.row or
				(highlight.row == start.row and highlight.column + highlight.word.length <= start.column)
			highlightIsAllAfterRange =
				highlight.row > end.row or
				(highlight.row == end.row and highlight.column >= end.column)
			!(highlightIsAllBeforeRange or highlightIsAllAfterRange)

		_isHighlightAfterRange: (highlight, start, end) ->
			return true if highlight.row > end.row
			return false if highlight.row < end.row
			highlight.column >= end.column
			


			

	

