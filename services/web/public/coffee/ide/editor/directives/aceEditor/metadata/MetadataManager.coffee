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

				end = change.end
				lineText = @editor.getSession().getLine end.row

				# Defensive check against extremely long lines
				return if lineText.length > 10000

				# Check if edited line contains metadata commands
				if /\\(usepackage|RequirePackage|label)(\[.*])?({.*})?/.test(lineText)
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
