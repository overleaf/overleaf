define [
], () ->
	class LabelsManager
		constructor: (@ide, @$scope) ->

			@$scope.$root._labels = @state =
				documents: {}

			window.STATE = @state

			setTimeout(
				(self) ->
					self.$scope.$on 'document:opened', (e, doc) ->
						console.log ">> [LabelsManager] document opened"
						setTimeout(
							(self, doc) ->
								self.loadLabelsFromDoc(doc)
							, 1000
							, self
							, doc
						)
				, 0
				this
			)

		loadLabelsFromDoc: (doc) ->
			docId = doc.doc_id
			console.log ">> [LabelsMangager] loading labels", docId
			docText = doc._doc.getText()
			labels = []
			re = /\\label{(.*)}/g
			while labelMatch = re.exec(docText)
				labels.push(labelMatch[1])
			@state.documents[docId] = labels
			console.log ">> [LabelsMangager] success, loaded labels", docId, labels

		getAllLabels: () ->
			_.flatten(labels for docId, labels of @state.documents)
