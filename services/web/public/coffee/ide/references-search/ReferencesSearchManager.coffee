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

			setTimeout(
				(self) ->
					self.ide.socket.on 'references:keys:updated', (keys) ->
						self._storeReferencesKeys(keys)
				, 100
				, this
			)

		_storeReferencesKeys: (newKeys) ->
			if window._ENABLE_REFERENCES_AUTOCOMPLETE != true
				return
			console.log '>> storing references keys'
			@$scope.$root._references.keys = newKeys

		# docIds: List[String]|String('ALL'), shouldBroadcast: Bool
		indexReferences: (docIds, shouldBroadcast) ->
			opts =
				docIds: docIds
				shouldBroadcast: shouldBroadcast
				_csrf: window.csrfToken
			$.post(
				"/project/#{@$scope.project_id}/references/index",
				opts,
				(data) =>
					console.log ">> got keys ", data
					@_storeReferencesKeys(data.keys)
			)
