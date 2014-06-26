define [
	"ide/track-changes/TrackChangesListController"
], () ->
	class TrackChangesManager
		constructor: (@ide, @$scope) ->
			@$scope.trackChanges = {
				updates: []
				nextBeforeTimestamp: null
				atEnd: false
			}

			@$scope.toggleTrackChanges = () =>
				if @$scope.ui.view == "track-changes"
					@$scope.ui.view = "editor"
				else
					@$scope.ui.view = "track-changes"

			@$scope.$on "file-tree:initialized", () =>
				@fetchNextBatchOfChanges()

		BATCH_SIZE: 4
		fetchNextBatchOfChanges: () ->
			url = "/project/#{@ide.project_id}/updates?min_count=#{@BATCH_SIZE}"
			if @nextBeforeTimestamp?
				url += "&before=#{@$scope.trackChanges.nextBeforeTimestamp}"
			@ide.$http
				.get(url)
				.success (data) =>
					@_loadUpdates(data.updates)
					@$scope.trackChanges.nextBeforeTimestamp = data.nextBeforeTimestamp
					if !data.nextBeforeTimestamp?
						@$scope.trackChanges.atEnd = true

		_loadUpdates: (updates = []) ->
			previousUpdate = @$scope.trackChanges.updates[@$scope.trackChanges.updates.length - 1]

			for update in updates
				for doc_id, doc of update.docs or {}
					doc.entity = @ide.fileTreeManager.findEntityById(doc_id)

				for user in update.meta.users or []
					user.hue = @ide.onlineUsersManager.getHueForUserId(user.id)

				if !previousUpdate? or !moment(previousUpdate.meta.end_ts).isSame(update.meta.end_ts, "day")
					update.meta.first_in_day = true

				update.selectedFrom = false
				update.selectedTo = false
				update.inSelection = false

				previousUpdate = update

			@$scope.trackChanges.updates =
				@$scope.trackChanges.updates.concat(updates)
