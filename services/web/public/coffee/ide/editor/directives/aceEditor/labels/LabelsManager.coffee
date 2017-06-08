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

			window.GET_LABELS = () =>
				@loadProjectLabelsFromServer()

			window.GET_DOC_LABELS = () =>
				@loadCurrentDocLabelsFromServer()

			@state =
				documents: {} # map of DocId => List[Label]

			@loadLabelsTimeout = null

			@$scope.$on 'doc:labels:updated', (e, data) =>
				if data.docId and data.labels
					@state.documents[data.docId] = data.labels

			@$scope.$on 'entity:deleted', (e, entity) =>
				if entity.type == 'doc'
					delete @state.documents[entity.id]

			@$scope.$on 'file:upload:complete', (e, upload) =>
				if upload.entity_type == 'doc'
					@loadDocLabelsFromServer(upload.entity_id)

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
					# @scheduleLoadLabelsFromOpenDoc()

			@editor.on "changeSession", (e) =>
				e.oldSession.off "change", onChange
				e.session.on "change", onChange
				# setTimeout(
				# 	() =>
				# 		# @scheduleLoadLabelsFromOpenDoc()
				# 		@loadProjectLabelsFromServer()
				# 	, 0
				# )

			# Load now
			@loadProjectLabelsFromServer()

		loadProjectLabelsFromServer: () ->
			$.get(
				"/project/#{window.project_id}/labels"
				, (data) =>
					if data.projectLabels
						for docId, docLabels of data.projectLabels
							@state.documents[docId] = docLabels
			)

		loadCurrentDocLabelsFromServer: () ->
			currentDocId = @$scope.docId
			@loadDocLabelsFromServer(currentDocId)

		loadDocLabelsFromServer: (docId) ->
			$.get(
				"/project/#{window.project_id}/#{docId}/labels"
				, (data) =>
					if data.docId and data.labels
						@state.documents[data.docId] = data.labels
			)

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
			_.flatten(labels for docId, labels of @state.documents)
