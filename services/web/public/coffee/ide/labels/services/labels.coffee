define [
	"base"
], (App) ->

	App.factory 'labels', ($http, ide) ->

		state = {documents: {}}

		labels = {
			state: state
		}

		labels.onBroadcastDocLabels = (data) ->
			if data.docId? and data.meta?
				state.documents[data.docId] = data.meta

		labels.onEntityDeleted = (e, entity) ->
			if entity.type == 'doc'
				delete state.documents[entity.id]

		labels.onFileUploadComplete = (e, upload) ->
			if upload.entity_type == 'doc'
				labels.loadDocLabelsFromServer upload.entity_id

		labels.getAllLabels = () ->
			_.flatten(meta.labels for docId, meta of state.documents)

		labels.getAllPackages = () ->
			_.flatten(meta.packages for docId, meta of state.documents)

		labels.loadProjectLabelsFromServer = () ->
			$http
				.get("/project/#{window.project_id}/labels")
				.then (response) ->
					{ data } = response
					if data.projectMeta
						for docId, docMeta of data.projectMeta
							state.documents[docId] = docMeta.labels

		labels.loadDocLabelsFromServer = (docId) ->
			$http
				.post(
					"/project/#{window.project_id}/doc/#{docId}/labels",
					{_csrf: window.csrfToken}
				)

		return labels
