define [
], () ->
	class ReferencesSearchManager
		constructor: (@ide, @$scope) ->

			@$scope.$on 'document:closed', (e, doc) =>
				if doc.doc_id
				 	entity = @ide.fileTreeManager.findEntityById doc.doc_id
					if entity?.name?.match /.*\.bib$/
						@$scope.$emit 'references:changed', entity
						console.log ">> references changed"
						@indexReferences doc.doc_id

		indexReferences: (doc_id) ->
			$.post(
				"/project/#{@$scope.project_id}/references",
				{
					docId: doc_id,
					_csrf: window.csrfToken
				},
				(data) =>
					console.log(data)
					setTimeout(
						( () -> @getReferenceKeys() ).bind(this),
						100
					)
			)

		getReferenceKeys: () ->
			$.get(
				"/project/#{@$scope.project_id}/references/keys",
				{
					_csrf: window.csrfToken
				},
				(data) =>
					console.log ">> got keys"
					console.log(data)
			)
