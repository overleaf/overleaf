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

			@state =
				documents: {} # map of DocId => List[Label]

			@loadLabelsTimeout = null

			onChange = (change) =>
				cursorPosition = @editor.getCursorPosition()
				end = change.end
				range = new Range(end.row, 0, end.row, end.column)
				lineUpToCursor = @editor.getSession().getTextRange(range)
				commandFragment = getLastCommandFragment(lineUpToCursor)
				if (
					!change.remote and
					change.action in ['remove', 'insert'] and
					((_.any(change.lines, (line) -> line.match(/\\label\{[^\}\n\\]{0,80}\}/))) or
					 (commandFragment?.length > 2 and commandFragment.slice(0,7) == '\\label{'))
				)
					@scheduleLoadLabelsFromOpenDoc()

			@editor.on "changeSession", (e) =>
				e.oldSession.off "change", onChange
				e.session.on "change", onChange
				setTimeout(
					() =>
						# @scheduleLoadLabelsFromOpenDoc()
						@loadProjectLabelsFromServer()
					, 0
				)

		loadProjectLabelsFromServer: () ->
			$.get(
				"/project/#{window.project_id}/labels"
				, (data) =>
					console.log ">>", data
					if data.labels
						for docId, docLabels of data.labels
							@state.documents[docId] = docLabels
					console.log @state.documents
			)

		loadLabelsFromOpenDoc: () ->
			docId = @$scope.docId
			docText = @editor.getValue()
			labels = []
			re = /\\label\{([^\}\n\\]{0,80})\}/g
			while (labelMatch = re.exec(docText)) and labels.length < 1000
				if labelMatch[1]
					labels.push(labelMatch[1])
			@state.documents[docId] = labels

		scheduleLoadLabelsFromOpenDoc: () ->
			# De-bounce loading labels with a timeout
			if @loadLabelsTimeout
				clearTimeout(@loadLabelsTimeout)
			@loadLabelsTimeout = setTimeout(
				() =>
					@loadLabelsFromOpenDoc()
				, 1000
				, this
			)

		getAllLabels: () ->
			_.flatten(labels for docId, labels of @state.documents)
