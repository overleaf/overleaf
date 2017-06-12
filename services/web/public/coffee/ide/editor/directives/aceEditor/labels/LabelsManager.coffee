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
		constructor: (@$scope, @editor, @element, @Labels) ->
			@loadLabelsTimeout = null

			onChange = (change) =>
				if change.remote
					return
				if change.action not in ['remove', 'insert']
					return
				cursorPosition = @editor.getCursorPosition()
				end = change.end
				range = new Range(end.row, 0, end.row, end.column)
				lineUpToCursor = @editor.getSession().getTextRange(range)
				commandFragment = getLastCommandFragment(lineUpToCursor)
				linesContainLabel = _.any(change.lines, (line) -> line.match(/\\label\{[^\}\n\\]{0,80}\}/))
				lastCommandFragmentIsLabel = commandFragment?.slice(0,7) == '\\label{'
				if linesContainLabel or lastCommandFragmentIsLabel
					@scheduleLoadCurrentDocLabelsFromServer()

			@editor.on "changeSession", (e) =>
				e.oldSession.off "change", onChange
				e.session.on "change", onChange

		loadCurrentDocLabelsFromServer: () ->
			currentDocId = @$scope.docId
			@Labels.loadDocLabelsFromServer(currentDocId)

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
			@Labels.getAllLabels()
