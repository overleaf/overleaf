define [
], () ->
	class ReferencesManager
		constructor: (@ide, @$scope) ->

			@$scope.$root._references = @state = keys: []

			@$scope.$on 'document:closed', (e, doc) =>
				if doc.doc_id
				 	entity = @ide.fileTreeManager.findEntityById doc.doc_id
					if entity?.name?.match /.*\.bib$/
						@indexReferences([doc.doc_id], true)

			@$scope.$on 'references:should-reindex', (e, data) =>
				@indexAllReferences(true)

			# When we join the project:
			#   index all references files
			#   and don't broadcast to all clients
			@inited = false
			@$scope.$on 'project:joined', (e) =>
				# We only need to grab the references when the editor first loads,
				# not on every reconnect
				if !@inited
					@inited = true
					@indexAllReferences(false)

			setTimeout(
				(self) ->
					self.ide.socket.on 'references:keys:updated', (keys) ->
						# console.log '>> got keys from socket'
						self._storeReferencesKeys(keys)
				, 1000
				, this
			)

		_storeReferencesKeys: (newKeys) ->
			# console.log '>> storing references keys'
			oldKeys = @$scope.$root._references.keys
			@$scope.$root._references.keys = _.union(oldKeys, newKeys)

		indexReferences: (docIds, shouldBroadcast) ->
			opts =
				docIds: docIds
				shouldBroadcast: shouldBroadcast
				_csrf: window.csrfToken
			$.post(
				"/project/#{@$scope.project_id}/references/index",
				opts,
				(data) =>
					# console.log ">> got keys ", data
					@_storeReferencesKeys(data.keys)
			)

		indexAllReferences: (shouldBroadcast) ->
			opts =
				shouldBroadcast: shouldBroadcast
				_csrf: window.csrfToken
			$.post(
				"/project/#{@$scope.project_id}/references/indexAll",
				opts,
				(data) =>
					# console.log ">> got keys ", data
					@_storeReferencesKeys(data.keys)
			)
