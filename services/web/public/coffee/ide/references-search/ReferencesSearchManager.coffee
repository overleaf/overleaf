define [
], () ->
	class ReferencesSearchManager
		constructor: (@ide, @$scope) ->
			console.log ">> yay"

			@$scope.$on 'document:closed', (e, doc) =>
				if doc.doc_id
				 	entity = @ide.fileTreeManager.findEntityById doc.doc_id
					if entity?.name?.match /.*\.bib$/
						@$scope.$emit 'references:changed', entity
						console.log ">> references changed"
						@indexReferences doc.doc_id

		indexReferences: (doc_id) ->
			console.log ">> doc id #{doc_id}"
			$.post("/project/#{@$scope.project_id}/references", {
				docId: doc_id,
				_csrf: window.csrfToken
			}, (data) => console.log(data))
