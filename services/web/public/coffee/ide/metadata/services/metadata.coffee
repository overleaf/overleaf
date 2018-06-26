define [
	"base"
], (App) ->

	App.factory 'metadata', ($http, ide) ->
		debouncer = {}  # DocId => Timeout

		state = {documents: {}}

		metadata = {state: state}

		metadata.onBroadcastDocMeta = (data) ->
			if data.docId? and data.meta?
				state.documents[data.docId] = data.meta

		metadata.onEntityDeleted = (e, entity) ->
			if entity.type == 'doc'
				delete state.documents[entity.id]

		metadata.onFileUploadComplete = (e, upload) ->
			if upload.entity_type == 'doc'
				metadata.loadDocMetaFromServer upload.entity_id

		metadata.getAllLabels = () ->
			_.flatten(meta.labels for docId, meta of state.documents)

		metadata.getAllPackages = () ->
			packageCommandMapping = {}
			for _docId, meta of state.documents
				for packageName, commandSnippets of meta.packages
					packageCommandMapping[packageName] = commandSnippets
			return packageCommandMapping

		metadata.loadProjectMetaFromServer = () ->
			$http
				.get("/project/#{window.project_id}/metadata")
				.then (response) ->
					{ data } = response
					if data.projectMeta
						for docId, docMeta of data.projectMeta
							state.documents[docId] = docMeta

		metadata.loadDocMetaFromServer = (docId) ->
			$http
				.post(
					"/project/#{window.project_id}/doc/#{docId}/metadata",
					{_csrf: window.csrfToken}
				)

		metadata.scheduleLoadDocMetaFromServer = (docId) ->
			# De-bounce loading labels with a timeout
			existingTimeout = debouncer[docId]

			if existingTimeout?
				clearTimeout(existingTimeout)
				delete debouncer[docId]

			debouncer[docId] = setTimeout(
				() =>
					metadata.loadDocMetaFromServer docId
					delete debouncer[docId]
				, 1000
			)

		return metadata
