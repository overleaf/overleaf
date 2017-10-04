define [
	"base"
], (App) ->

	App.factory 'metadata', ($http, ide) ->

		state = {documents: {}}

		metadata = {
			state: state
		}

		metadata.onBroadcastDocMetadata = (data) ->
			if data.docId and data.metadata
				state.documents[data.docId] = data.metadata

		metadata.onEntityDeleted = (e, entity) ->
			if entity.type == 'doc'
				delete state.documents[entity.id]

		metadata.onFileUploadComplete = (e, upload) ->
			if upload.entity_type == 'doc'
				metadata.loadDocMetadataFromServer(upload.entity_id)

		metadata.getAllMetadata = () ->
			labels = _.flatten(meta['labels'] for docId, meta of state.documents)
			packages = _.flatten(meta['packages'] for docId, meta of state.documents)
			{labels: labels, packages: packages}

		metadata.loadProjectMetadataFromServer = () ->
			$http
				.get("/project/#{window.project_id}/metadata")
				.then (response) ->
					{ data } = response
					if data.projectMetadata
						for docId, docMetadata of data.projectMetadata
							state.documents[docId] = docMetadata

		metadata.loadDocMetadataFromServer = (docId) ->
			$http
				.post(
					"/project/#{window.project_id}/doc/#{docId}/metadata",
					{_csrf: window.csrfToken}
				)

		return metadata
