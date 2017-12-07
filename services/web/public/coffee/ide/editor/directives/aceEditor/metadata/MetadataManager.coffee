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
			@debouncer = {}  # DocId => Timeout

			onChange = (change) =>
				if change.remote
					return
				if change.action not in ['remove', 'insert']
					return
				cursorPosition = @editor.getCursorPosition()
				end = change.end
				range = new Range(end.row, 0, end.row, end.column)
				lineUpToCursor = @editor.getSession().getTextRange range
				if lineUpToCursor.trim() == '%' or lineUpToCursor.slice(0, 1) == '\\'
					range = new Range(end.row, 0, end.row, end.column + 80)
					lineUpToCursor = @editor.getSession().getTextRange range
				commandFragment = getLastCommandFragment lineUpToCursor

				linesContainPackage = _.any(
					change.lines,
					(line) -> line.match(/^\\usepackage(?:\[.{0,80}?])?{(.{0,80}?)}/)
				)
				linesContainReqPackage = _.any(
					change.lines,
					(line) -> line.match(/^\\RequirePackage(?:\[.{0,80}?])?{(.{0,80}?)}/)
				)
				linesContainLabel = _.any(
					change.lines,
					(line) -> line.match(/\\label{(.{0,80}?)}/)
				)
				linesContainMeta =
					linesContainPackage or
					linesContainLabel or
					linesContainReqPackage

				lastCommandFragmentIsLabel = commandFragment?.slice(0, 7) == '\\label{'
				lastCommandFragmentIsPackage = commandFragment?.slice(0, 11) == '\\usepackage'
				lastCommandFragmentIsReqPack = commandFragment?.slice(0, 15) == '\\RequirePackage'
				lastCommandFragmentIsMeta =
					lastCommandFragmentIsPackage or
					lastCommandFragmentIsLabel or
					lastCommandFragmentIsReqPack

				if linesContainMeta or lastCommandFragmentIsMeta
					@scheduleLoadCurrentDocMetaFromServer()

			@editor.on "changeSession", (e) =>
				e.oldSession.off "change", onChange
				e.session.on "change", onChange


		loadDocMetaFromServer: (docId) ->
			@Metadata.loadDocMetaFromServer docId

		scheduleLoadCurrentDocMetaFromServer: () ->
			# De-bounce loading labels with a timeout
			currentDocId = @$scope.docId
			existingTimeout = @debouncer[currentDocId]
			if existingTimeout?
				clearTimeout(existingTimeout)
				delete @debouncer[currentDocId]
			@debouncer[currentDocId] = setTimeout(
				() =>
					@loadDocMetaFromServer currentDocId
					delete @debouncer[currentDocId]
				, 1000
				, this
			)

		getAllLabels: () ->
			@Metadata.getAllLabels()

		getAllPackages: () ->
			@Metadata.getAllPackages()
