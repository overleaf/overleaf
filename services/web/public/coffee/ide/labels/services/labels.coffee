define [
	"base"
], (App) ->

	App.factory 'labels', ($http, ide) ->

		state = {documents: {}}

		labels = {
			state: state
		}

		labels.onBroadcastDocLabels = (data) ->
			if data.docId and data.labels
				state.documents[data.docId] = data.labels

		labels.onEntityDeleted = (e, entity) ->
			if entity.type == 'doc'
				delete state.documents[entity.id]

		labels.onFileUploadComplete = (e, upload) ->
			if upload.entity_type == 'doc'
				labels.loadDocLabelsFromServer(upload.entity_id)

		labels.getAllLabels = () ->
			_.flatten(labels for docId, labels of state.documents)

		labels.loadProjectLabelsFromServer = () ->
			$http
				.get("/project/#{window.project_id}/labels")
				.then (data) ->
					if data.projectLabels
						for docId, docLabels of data.projectLabels
							state.documents[docId] = docLabels

		labels.loadDocLabelsFromServer = (docId) ->
			$http
				.post(
					"/project/#{window.project_id}/doc/#{docId}/labels",
					{_csrf: window.csrfToken}
				)
				.then (data) ->

		return labels
