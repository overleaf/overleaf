define [
], () ->
	class ReferencesSearchManager
		constructor: (@ide, @$scope) ->

			@$scope.$root._references = @state = keys: []

			@$scope.$on 'document:closed', (e, doc) =>
				if doc.doc_id
				 	entity = @ide.fileTreeManager.findEntityById doc.doc_id
					if entity?.name?.match /.*\.bib$/
						@$scope.$emit 'references:changed', entity
						@indexReferences([doc.doc_id], true)

			@$scope.$on 'project:joined', (e) =>
				@indexReferences("ALL", false)

		# docIds: List[String]|String('ALL'), shouldBroadcast: Bool
		indexReferences: (docIds, shouldBroadcast) ->
			if window._ENABLE_REFERENCES_AUTOCOMPLETE != true
				return
			opts =
				docIds: docIds
				shouldBroadcast: shouldBroadcast
				_csrf: window.csrfToken
			console.log ">>", opts
			$.post(
				"/project/#{@$scope.project_id}/references/index",
				opts,
				(data) =>
					console.log ">> done ", data
					@$scope.$root._references.keys = data.keys
			)

		getReferenceKeys: (callback=(keys)->) ->
			if window._ENABLE_REFERENCES_AUTOCOMPLETE != true
				return
			$.get(
				"/project/#{@$scope.project_id}/references/keys",
				{
					_csrf: window.csrfToken
				},
				(data) =>
					@$scope.$root._references.keys = data.keys
					if callback
						callback(data.keys)
			)
