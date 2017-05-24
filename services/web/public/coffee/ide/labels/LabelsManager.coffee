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
				(self) ->
					# set up a regular re-load
					setTimeout(
						(self) ->
							self.periodicLoadInterval = setInterval(
								(self) ->
									self.loadLabelsFromOpenDoc()
								, AUTOMATIC_REFRESH_PERIOD
								, self
							)
						, AUTOMATIC_REFRESH_PERIOD
						, self
					)
					# listen for document open
					self.$scope.$on 'document:opened', (e, doc) ->
						setTimeout(
							(self) ->
								self.scheduleLoadLabelsFromOpenDoc()
							, 1000
							, self
						)
				, 0
				this
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
				(self) ->
					self.loadLabelsFromOpenDoc()
				, 1000
				, this
			)

		getAllLabels: () ->
			_.flatten(labels for docId, labels of @state.documents)
