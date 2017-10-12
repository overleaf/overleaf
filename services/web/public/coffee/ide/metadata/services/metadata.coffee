define [
	"base"
], (App) ->

	App.factory 'metadata', ($http, ide) ->

		state = {documents: {}}

		metadata = {
			state: state
		}

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
			_.flatten(meta.packages for docId, meta of state.documents)

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

		return metadata
