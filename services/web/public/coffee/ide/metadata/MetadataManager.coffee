define [], () ->

	class MetadataManager

		constructor: (@ide, @$scope, @metadata) ->

			@ide.socket.on 'broadcastDocMeta', (data) =>
				@metadata.onBroadcastDocMeta data
			@$scope.$on 'entity:deleted', @metadata.onEntityDeleted
			@$scope.$on 'file:upload:complete', @metadata.fileUploadComplete

		loadProjectMetaFromServer: () ->
			@metadata.loadProjectMetaFromServer()
