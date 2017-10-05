define [
	"ace/ace"
], () ->
	Range = ace.require("ace/range").Range

	getLastCommandFragment = (lineUpToCursor) ->
		if m = lineUpToCursor.match(/(\\[^\\]+)$/)
			return m[1]
		else
			return null

	class MetadataManager
		constructor: (@$scope, @editor, @element, @Metadata) ->
			@debouncer = {} # DocId => Timeout

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

				linesContainLabel = _.any(
					change.lines,
					(line) -> line.match(/\\label\{[^\}\n\\]{0,80}\}/)
				)
				linesContainPackage = _.any(
					change.lines,
					(line) -> line.match(/\\usepackage(?:\[.*?])?\s*{.*?}/)
				)
				linesContainMeta = linesContainPackage or linesContainLabel

				lastCommandFragmentIsLabel = commandFragment?.startsWith '\\label{'
				lastCommandFragmentIsPackage = commandFragment?.startsWith '\\usepackage'
				lastCommandFragmentIsMeta = lastCommandFragmentIsPackage or lastCommandFragmentIsLabel

				if linesContainMeta or lastCommandFragmentIsMeta
					@scheduleLoadCurrentDocMetadataFromServer()

			@editor.on 'changeSession', (e) =>
				e.oldSession.off 'change', onChange
				e.session.on 'change', onChange

		loadCurrentDocMetadataFromServer: () ->
			currentDocId = @$scope.docId
			@Metadata.loadDocMetadataFromServer currentDocId

		loadDocMetadataFromServer: (docId) ->
			@Metadata.loadDocMetadataFromServer docId

		scheduleLoadCurrentDocMetadataFromServer: () ->
			# De-bounce loading labels with a timeout
			currentDocId = @$scope.docId
			existingTimeout = @debouncer[currentDocId]
			if existingTimeout?
				clearTimeout(existingTimeout)
				delete @debouncer[currentDocId]
			@debouncer[currentDocId] = setTimeout(
				() =>
					@loadDocMetadataFromServer(currentDocId)
					delete @debouncer[currentDocId]
				, 1000
				, this
			)

		getAllLabels: () ->
			@Metadata.getAllLabels()

		getAllPackages: () ->
			@Metadata.getAllPackages()

		getAllMetadata: () ->
			@Metadata.getAllMetadata()
