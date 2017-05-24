define [
], () ->
	class LabelsManager
		constructor: (@ide, @$scope) ->
			@$scope.$root._labels = this

			@state =
				documents: {}

			@loadLabelsTimeout = null

			setTimeout(
				(self) ->
					self.$scope.$on 'document:opened', (e, doc) ->
						# console.log ">> [LabelsManager] document opened"
						setTimeout(
							(self) ->
								self.loadLabelsFromOpenDoc()
							, 1000
							, self
						)
				, 0
				this
			)

		loadLabelsFromOpenDoc: () ->
			docId = @ide.editorManager.getCurrentDocId()
			# console.log ">> [LabelsMangager] loading labels", docId
			docText = @ide.editorManager.getCurrentDocValue()
			labels = []
			re = /\\label{(.*)}/g
			while labelMatch = re.exec(docText)
				if labelMatch[1]
					labels.push(labelMatch[1])
			@state.documents[docId] = labels
			# console.log ">> [LabelsMangager] success, loaded labels", docId, labels

		scheduleLoadLabelsFromOpenDoc: () ->
			if @loadLabelsTimeout
				clearTimeout(@loadLabelsTimeout)
			@loadLabelsTimeout = setTimeout(
				(self) ->
					# console.log ">> trigger timeout"
					self.loadLabelsFromOpenDoc()
				, 500
				, this
			)

		getAllLabels: () ->
			_.flatten(labels for docId, labels of @state.documents)
