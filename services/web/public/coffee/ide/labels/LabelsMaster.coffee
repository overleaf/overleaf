define [
], () ->
	class LabelsMaster
		constructor: (@ide, @$scope) ->

			@_state = {
				documents: {}
			}

			@$scope.$on 'doc:labels:updated', (e, data) =>
				if data.docId and data.labels
					@_state.documents[data.docId] = data.labels

			@$scope.$on 'entity:deleted', (e, entity) =>
				if entity.type == 'doc'
					delete @_state.documents[entity.id]

			@$scope.$on 'file:upload:complete', (e, upload) =>
				if upload.entity_type == 'doc'
					@loadDocLabelsFromServer(upload.entity_id)

			# load project labels now
			@loadProjectLabelsFromServer()

		getAllLabels: () ->
			_.flatten(labels for docId, labels of @_state.documents)

		## Loaders
		loadProjectLabelsFromServer: () ->
			$.get(
				"/project/#{window.project_id}/labels"
				, (data) =>
					if data.projectLabels
						for docId, docLabels of data.projectLabels
							@_state.documents[docId] = docLabels
			)

		loadDocLabelsFromServer: (docId) ->
			$.get(
				"/project/#{window.project_id}/#{docId}/labels"
				, (data) =>
					if data.docId and data.labels
						@_state.documents[data.docId] = data.labels
			)
