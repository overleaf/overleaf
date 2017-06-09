define [
	"ace/ace"
], () ->
	Range = ace.require("ace/range").Range

	getLastCommandFragment = (lineUpToCursor) ->
		if m = lineUpToCursor.match(/(\\[^\\]+)$/)
			return m[1]
		else
			return null

	class LabelsManager
		constructor: (@$scope, @editor, @element) ->
			@labelsMaster = @$scope.labelsMaster
			@loadLabelsTimeout = null

			onChange = (change) =>
				if change.remote
					return
				cursorPosition = @editor.getCursorPosition()
				end = change.end
				range = new Range(end.row, 0, end.row, end.column)
				lineUpToCursor = @editor.getSession().getTextRange(range)
				commandFragment = getLastCommandFragment(lineUpToCursor)
				if (
					change.action in ['remove', 'insert'] and
					((_.any(change.lines, (line) -> line.match(/\\label\{[^\}\n\\]{0,80}\}/))) or
					 (commandFragment?.length > 2 and commandFragment.slice(0,7) == '\\label{'))
				)
					@scheduleLoadCurrentDocLabelsFromServer()

			@editor.on "changeSession", (e) =>
				e.oldSession.off "change", onChange
				e.session.on "change", onChange

		loadCurrentDocLabelsFromServer: () ->
			currentDocId = @$scope.docId
			@labelsMaster.loadDocLabelsFromServer(currentDocId)

		scheduleLoadCurrentDocLabelsFromServer: () ->
			# De-bounce loading labels with a timeout
			if @loadLabelsTimeout
				clearTimeout(@loadLabelsTimeout)
			@loadLabelsTimeout = setTimeout(
				() =>
					@loadCurrentDocLabelsFromServer()
				, 1000
				, this
			)

		getAllLabels: () ->
			@labelsMaster.getAllLabels()
