define [
], () ->

	class LabelsManager
		constructor: (@ide, @$scope) ->
			@$scope.$root._labels = this

			@state =
				documents: {} # map of DocId => List[Label]

			@loadLabelsTimeout = null

			setTimeout(
				() =>
					# listen for document open
					@$scope.$on 'document:opened', (e, doc) =>
						setTimeout(
							() =>
								@scheduleLoadLabelsFromOpenDoc()
							, 0
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
