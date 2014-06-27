define [
	"ide/track-changes/TrackChangesListController"
], () ->
	class TrackChangesManager
		constructor: (@ide, @$scope) ->
			@$scope.trackChanges = {
				updates: []
				nextBeforeTimestamp: null
				atEnd: false
				selection: {
					updates: []
					doc: null
					range: {
						fromV: null
						toV: null
						start_ts: null
						end_ts: null
					}
				}
				diff: null
			}

			@$scope.toggleTrackChanges = () =>
				if @$scope.ui.view == "track-changes"
					@$scope.ui.view = "editor"
				else
					@$scope.ui.view = "track-changes"

			@$scope.$on "file-tree:initialized", () =>
				@fetchNextBatchOfChanges()

			@$scope.$watch "trackChanges.selection.updates", () =>
				@$scope.trackChanges.selection.range = @_calculateRangeFromSelection()
				@reloadDiff()

			@$scope.$on "entity:selected", (event, entity) =>
				if (@$scope.ui.view == "track-changes") and (entity.type == "doc")
					@$scope.trackChanges.selection.doc = entity
					@$scope.trackChanges.selection.range = @_calculateRangeFromSelection()
					@reloadDiff()

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

		reloadDiff: () ->
			console.log "Checking if diff has changed"

			diff = @$scope.trackChanges.diff
			{updates, doc} = @$scope.trackChanges.selection
			{fromV, toV}   = @$scope.trackChanges.selection.range

			return if !doc?

			return if diff? and
				diff.doc   == doc   and
				diff.fromV == fromV and
				diff.toV   == toV

			console.log "Loading diff", fromV, toV, doc?.id

			@$scope.trackChanges.diff = diff = {
				fromV:   fromV
				toV:     toV
				doc:     doc
				loading: true
				error:   false
			}

			url = "/project/#{@$scope.project_id}/doc/#{diff.doc.id}/diff"
			if diff.fromV? and diff.toV?
				url += "?from=#{diff.fromV}&to=#{diff.toV}"

			@ide.$http
				.get(url)
				.success (data) =>
					diff.loading = false
					{text, annotations} = @_parseDiff(data)
					diff.text = text
					diff.annotations = annotations
				.error () ->
					diff.loading = false
					diff.error = true

		_parseDiff: (diff) ->
			row    = 0
			column = 0
			annotations = []
			text   = ""
			for entry, i in diff.diff or []
				content = entry.u or entry.i or entry.d
				content ||= ""
				text += content
				lines   = content.split("\n")
				startRow    = row
				startColumn = column
				if lines.length > 1
					endRow    = startRow + lines.length - 1
					endColumn = lines[lines.length - 1].length
				else
					endRow    = startRow
					endColumn = startColumn + lines[0].length
				row    = endRow
				column = endColumn

				range = {
					start:
						row: startRow
						column: startColumn
					end:
						row: endRow
						column: endColumn
				}

				if entry.i?
					annotations.push {
						label: entry.meta.user.first_name
						highlight: range
						hue: @ide.onlineUsersManager.getHueForUserId(entry.meta.user.id)
					}
				else if entry.d?
					annotations.push {
						label: entry.meta.user.first_name
						strikeThrough: range
						hue: @ide.onlineUsersManager.getHueForUserId(entry.meta.user.id)
					}

			return {text, annotations}

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

		_calculateRangeFromSelection: () ->
			fromV = toV = start_ts = end_ts = null

			selected_doc_id = @$scope.trackChanges.selection.doc?.id

			for update in @$scope.trackChanges.selection.updates or []
				console.log "Checking update", update
				for doc_id, doc of update.docs
					console.log "Checking doc", doc_id, selected_doc_id, doc.fromV, doc.toV
					if doc_id == selected_doc_id
						console.log "Doc matches"
						if fromV? and toV?
							fromV = Math.min(fromV, doc.fromV)
							toV = Math.max(toV, doc.toV)
							start_ts = Math.min(start_ts, update.meta.start_ts)
							end_ts = Math.max(end_ts, update.meta.end_ts)
						else
							fromV = doc.fromV
							toV = doc.toV
							start_ts = update.meta.start_ts
							end_ts = update.meta.end_ts
						break

			return {fromV, toV, start_ts, end_ts}
