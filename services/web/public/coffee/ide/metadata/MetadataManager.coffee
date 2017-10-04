define [], () ->

	class MetadataManager

		constructor: (@ide, @$scope, @metadata) ->

			@ide.socket.on 'broadcastDocMetadata', (data) =>
				@metadata.onBroadcastDocMetadata(data)
			@$scope.$on 'entity:deleted', @metadata.onEntityDeleted
			@$scope.$on 'file:upload:complete', @metadata.fileUploadComplete

		loadProjectMetadataFromServer: () ->
			@metadata.loadProjectMetadataFromServer()
