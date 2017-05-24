define [
], () ->

	AUTOMATIC_REFRESH_PERIOD = 1000 * 60 * 10

	class LabelsManager
		constructor: (@ide, @$scope) ->
			@$scope.$root._labels = this

			@state =
				documents: {} # map of DocId => List[Label]

			@loadLabelsTimeout = null
			@periodicLoadInterval = null

			setTimeout(
				() =>
					# set up a regular re-load
					setTimeout(
						() =>
							@periodicLoadInterval = setInterval(
								() =>
									@loadLabelsFromOpenDoc()
								, AUTOMATIC_REFRESH_PERIOD
							)
						, AUTOMATIC_REFRESH_PERIOD
					)
					# listen for document open
					@$scope.$on 'document:opened', (e, doc) =>
						setTimeout(
							() =>
								@scheduleLoadLabelsFromOpenDoc()
							, 1000
						)
				, 0
			)

		loadLabelsFromOpenDoc: () ->
			docId = @ide.editorManager.getCurrentDocId()
			docText = @ide.editorManager.getCurrentDocValue()
			labels = []
			re = /\\label{(.*)}/g
			while labelMatch = re.exec(docText)
				if labelMatch[1]
					labels.push(labelMatch[1])
			@state.documents[docId] = labels

		scheduleLoadLabelsFromOpenDoc: () ->
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
