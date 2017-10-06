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
			@debouncer = {}  # DocId => Timeout

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

				linesContainPackage = _.any(
					change.lines,
					(line) -> line.match(/\\usepackage(?:\[.*?])?\s*{.*?}/)
				)
				linesContainLabel = _.any(
					change.lines,
					(line) -> line.match(/\\label\{[^\}\n\\]{0,80}\}/)
				)
				linesContainMeta = linesContainPackage or linesContainLabel

				lastCommandFragmentIsLabel = commandFragment?.startsWith '\\label{'
				lastCommandFragmentIsPackage = commandFragment?.startsWith '\\usepackage'
				lastCommandFragmentIsMeta = lastCommandFragmentIsPackage or lastCommandFragmentIsLabel

				if linesContainMeta or lastCommandFragmentIsMeta
					@scheduleLoadCurrentDocLabelsFromServer()

			@editor.on "changeSession", (e) =>
				e.oldSession.off "change", onChange
				e.session.on "change", onChange

		loadCurrentDocLabelsFromServer: () ->
			currentDocId = @$scope.docId
			@Labels.loadDocLabelsFromServer currentDocId

		loadDocLabelsFromServer: (docId) ->
			@Labels.loadDocLabelsFromServer docId

		scheduleLoadCurrentDocLabelsFromServer: () ->
			# De-bounce loading labels with a timeout
			currentDocId = @$scope.docId
			existingTimeout = @debouncer[currentDocId]
			if existingTimeout?
				clearTimeout(existingTimeout)
				delete @debouncer[currentDocId]
			@debouncer[currentDocId] = setTimeout(
				() =>
					@loadDocLabelsFromServer currentDocId
					delete @debouncer[currentDocId]
				, 1000
				, this
			)

		getAllLabels: () ->
			@Labels.getAllLabels()

		getAllPackages: () ->
			@Labels.getAllPackages()
